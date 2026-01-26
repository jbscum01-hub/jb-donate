import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { DONATE_PACKS } from "../../domain/catalog.js";
import { addDays } from "../../domain/time.js";
import { IDS } from "../../config/constants.js";
import { collectAllAttachments } from "../utils/attachments.js";
import { safeReply } from "../utils/messages.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";

function needPlate(order) {
  // Needs plate if it has vehicle/boat selection OR donate pack has any insurance
  if (order.type !== "DONATE") return false;
  const p = DONATE_PACKS[order.pack_code];
  const hasVehicle = Boolean(order.selected_vehicle || order.selected_boat);
  const hasInsurance = Boolean(p?.carInsurance || p?.boatInsurance);
  return hasVehicle || hasInsurance;
}

export async function closeOrder(interaction) {
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }
  const orderNo = interaction.customId.split(":")[1];
  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  if (order.status !== "APPROVED") {
    return safeReply(interaction, { content: "❌ ต้อง APPROVE ก่อนจึงจะ CLOSE ได้", ephemeral: true });
  }

  if (needPlate(order) && !order.plate) {
    return safeReply(interaction, { content: "❌ ต้อง SET PLATE (ทะเบียน 6 หลัก) ก่อนปิดงาน", ephemeral: true });
  }

  // Grant insurance to plate at CLOSE (per your workflow)
  if (order.type === "DONATE" && order.plate) {
    const p = DONATE_PACKS[order.pack_code];
    const plate = order.plate;

    // Ensure vehicle record exists (SET PLATE should have created it)
    const vehicle = await VehiclesRepo.getByPlate(plate);
    const kindCar = "CAR";
    const kindBoat = "BOAT";

    const now = new Date();
    if (p?.carInsurance) {
      const expireAt = addDays(now, p.carInsurance.days);
      const current = await InsuranceRepo.getInsurance(plate, kindCar);
      const total = p.carInsurance.total;
      const used = current?.used ?? 0;
      await InsuranceRepo.upsertInsurance({ plate, kind: kindCar, total, used, expire_at: expireAt, order_no: orderNo, source: "DONATE_PACK" });
      await InsuranceRepo.log({ guild_id: interaction.guildId, plate, kind: kindCar, action: "GRANT", delta: total, order_no: orderNo, user_id: order.user_id, staff_id: interaction.user.id, note: "grant at CLOSE" });
    }
    if (p?.boatInsurance) {
      const expireAt = addDays(now, p.boatInsurance.days);
      const current = await InsuranceRepo.getInsurance(plate, kindBoat);
      const total = p.boatInsurance.total;
      const used = current?.used ?? 0;
      await InsuranceRepo.upsertInsurance({ plate, kind: kindBoat, total, used, expire_at: expireAt, order_no: orderNo, source: "DONATE_PACK" });
      await InsuranceRepo.log({ guild_id: interaction.guildId, plate, kind: kindBoat, action: "GRANT", delta: total, order_no: orderNo, user_id: order.user_id, staff_id: interaction.user.id, note: "grant at CLOSE" });
    }

    // Refresh vehicle card in plate log channel
    if (vehicle?.plate_card_message_id) {
      const plateLogCh = await interaction.client.channels.fetch(IDS.VEHICLE_PLATE_LOG_CHANNEL_ID);
      const msg = await plateLogCh.messages.fetch(vehicle.plate_card_message_id).catch(() => null);
      if (msg) {
        const ins = await InsuranceRepo.getInsurance(plate, vehicle.kind);
        await msg.edit(buildVehicleCard({
          plate,
          kind: vehicle.kind,
          model: vehicle.model,
          ownerUserId: vehicle.owner_user_id,
          ownerTag: vehicle.owner_tag,
          insurance: ins,
        }));
      }
    }
  }

  // Archive attachments (all)
  const ticketCh = interaction.channel;
  const attachments = await collectAllAttachments(ticketCh);

  const archiveCh = await interaction.client.channels.fetch(IDS.SLIP_ARCHIVE_CHANNEL_ID);
  const summary = [
    "🧾 **TICKET SUMMARY (SUCCESS)**",
    `Order: **${order.order_no}**`,
    `Buyer: <@${order.user_id}> (${order.user_tag})`,
    `IGN: ${order.ign}`,
    `SteamID: ${order.steam_id}`,
    `Pack: ${order.type}:${order.pack_code} (${order.amount}฿)`,
    `Plate: ${order.plate ?? "-"}`,
    `Staff: <@${interaction.user.id}>`,
    `Time: <t:${Math.floor(Date.now()/1000)}:f>`,
  ].join("\n");

  // Send summary + attachments (URLs)
  // Discord has file upload limits; we forward URLs to the archived message.
  const attachList = attachments.length
    ? attachments.map(a => `- ${a.name} (${a.contentType ?? "file"}): ${a.url}`).join("\n")
    : "- (no attachments)";

  await archiveCh.send(summary + "\n\n**Attachments:**\n" + attachList);

  // Update order status
  await OrdersRepo.setStatus(orderNo, "SUCCESS", interaction.user.id);

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "ORDER_CLOSE_SUCCESS",
    target: orderNo,
    meta: { plate: order.plate ?? null, attachments: attachments.length },
  });

  // DM user (best effort)
  try {
    const u = await interaction.client.users.fetch(order.user_id);
    await u.send(`✅ ออเดอร์ ${orderNo} สำเร็จแล้ว ขอบคุณสำหรับการสนับสนุน ❤️`);
  } catch {}

  await safeReply(interaction, { content: "✅ ปิดงานสำเร็จ กำลังลบห้อง…", ephemeral: true });

  // Delete channel
  await ticketCh.delete("Ticket closed SUCCESS").catch(()=>{});
}
