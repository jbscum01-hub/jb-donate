// src/discord/handlers/staff.close.js
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { DONATE_PACKS } from "../../domain/catalog.js";
import { IDS } from "../../config/constants.js";
import { collectAllAttachments } from "../utils/attachments.js";
import { safeReply } from "../utils/messages.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";

function requiredKindsForDonate(order) {
  const p = DONATE_PACKS?.[order.pack_code];
  const needCar = Boolean(p?.vehicleChoices?.length);
  const needBoat = Boolean(p?.boatChoices?.length);
  return { needCar, needBoat, pack: p };
}

function validateModelSelection(order) {
  if (order.type !== "DONATE") return { ok: true };

  const { needCar, needBoat, pack: p } = requiredKindsForDonate(order);
  if (!p) return { ok: false, msg: "❌ ไม่พบข้อมูลแพ็กในระบบ (catalog)" };

  if (needCar && !order.selected_vehicle) return { ok: false, msg: "❌ ต้องเลือก ‘รถ’ ก่อนจึงจะ CLOSE ได้" };
  if (needBoat && !order.selected_boat) return { ok: false, msg: "❌ ต้องเลือก ‘เรือ’ ก่อนจึงจะ CLOSE ได้" };

  return { ok: true };
}

function requiredPlatesForDonate(order) {
  const p = DONATE_PACKS?.[order.pack_code];

  // plate required if that kind is selected OR pack has insurance for that kind
  const requireCar = Boolean(order.selected_vehicle) || Boolean(p?.carInsurance);
  const requireBoat = Boolean(order.selected_boat) || Boolean(p?.boatInsurance);

  return { requireCar, requireBoat, pack: p };
}

async function refreshVehicleCard(client, plate, kind) {
  if (!plate) return;

  const v = await VehiclesRepo.getByPlate(plate);
  if (!v?.plate_card_message_id) return;

  const plateLogCh = await client.channels.fetch(IDS.VEHICLE_PLATE_LOG_CHANNEL_ID);
  const msg = await plateLogCh.messages.fetch(v.plate_card_message_id).catch(() => null);
  if (!msg) return;

  const ins = await InsuranceRepo.getInsurance(plate, kind);
  await msg.edit(buildVehicleCard({
    plate,
    kind,
    model: v.model,
    ownerUserId: v.owner_user_id,
    ownerTag: v.owner_tag,
    insurance: ins,
  }));
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

  // ✅ enforce model completeness
  const vm = validateModelSelection(order);
  if (!vm.ok) return safeReply(interaction, { content: vm.msg, ephemeral: true });

  // ✅ enforce plates when required
  if (order.type === "DONATE") {
    const { requireCar, requireBoat } = requiredPlatesForDonate(order);

    if (requireCar && !order.car_plate) {
      return safeReply(interaction, { content: "❌ ต้อง SET CAR PLATE (ทะเบียนรถ 6 หลัก) ก่อนปิดงาน", ephemeral: true });
    }
    if (requireBoat && !order.boat_plate) {
      return safeReply(interaction, { content: "❌ ต้อง SET BOAT PLATE (ทะเบียนเรือ 6 หลัก) ก่อนปิดงาน", ephemeral: true });
    }
  }

  // ✅ Grant insurance at CLOSE (DONATE only)
  if (order.type === "DONATE") {
    const { pack: p } = requiredPlatesForDonate(order);

    // CAR insurance
    if (p?.carInsurance) {
      await InsuranceRepo.upsertInsurance({
        plate: order.car_plate,
        kind: "CAR",
        add_total: p.carInsurance.total,  // ✅ accumulate
        days: p.carInsurance.days,        // ✅ extend expire
        order_no: orderNo,
        source: "DONATE_PACK",
      });

      await InsuranceRepo.log({
        guild_id: interaction.guildId,
        plate: order.car_plate,
        kind: "CAR",
        action: "GRANT",
        delta: p.carInsurance.total,
        order_no: orderNo,
        user_id: order.user_id,
        staff_id: interaction.user.id,
        note: `grant at CLOSE (DONATE:${order.pack_code})`,
      });

      await refreshVehicleCard(interaction.client, order.car_plate, "CAR");
    }

    // BOAT insurance
    if (p?.boatInsurance) {
      await InsuranceRepo.upsertInsurance({
        plate: order.boat_plate,
        kind: "BOAT",
        add_total: p.boatInsurance.total, // ✅ accumulate
        days: p.boatInsurance.days,       // ✅ extend expire
        order_no: orderNo,
        source: "DONATE_PACK",
      });

      await InsuranceRepo.log({
        guild_id: interaction.guildId,
        plate: order.boat_plate,
        kind: "BOAT",
        action: "GRANT",
        delta: p.boatInsurance.total,
        order_no: orderNo,
        user_id: order.user_id,
        staff_id: interaction.user.id,
        note: `grant at CLOSE (DONATE:${order.pack_code})`,
      });

      await refreshVehicleCard(interaction.client, order.boat_plate, "BOAT");
    }
  }

  // ===== Archive attachments =====
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
    `🚗 CAR: ${order.selected_vehicle ?? "-"}`,
    `🚤 BOAT: ${order.selected_boat ?? "-"}`,
    `CAR PLATE: ${order.car_plate ?? "-"}`,
    `BOAT PLATE: ${order.boat_plate ?? "-"}`,
    `Staff: <@${interaction.user.id}>`,
    `Time: <t:${Math.floor(Date.now() / 1000)}:f>`,
  ].join("\n");

  const attachList = attachments.length
    ? attachments.map(a => `- ${a.name} (${a.contentType ?? "file"}): ${a.url}`).join("\n")
    : "- (no attachments)";

  await archiveCh.send(summary + "\n\n**Attachments:**\n" + attachList);

  // ===== Update order status =====
  await OrdersRepo.setStatus(orderNo, "SUCCESS", interaction.user.id);

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "ORDER_CLOSE_SUCCESS",
    target: orderNo,
    meta: {
      selected_vehicle: order.selected_vehicle ?? null,
      selected_boat: order.selected_boat ?? null,
      car_plate: order.car_plate ?? null,
      boat_plate: order.boat_plate ?? null,
      attachments: attachments.length,
    },
  });

  // ===== DM user (best effort) =====
  try {
    const u = await interaction.client.users.fetch(order.user_id);
    await u.send(`✅ ออเดอร์ ${orderNo} สำเร็จแล้ว ขอบคุณสำหรับการสนับสนุน ❤️`);
  } catch {}

  await safeReply(interaction, { content: "✅ ปิดงานสำเร็จ กำลังลบห้อง…", ephemeral: true });
  await ticketCh.delete("Ticket closed SUCCESS").catch(() => {});
}
