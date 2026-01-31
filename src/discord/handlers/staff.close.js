// src/discord/handlers/staff.close.js
import { MessageFlags } from "discord.js";
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
import { VIP_PACKS } from "../../domain/catalog.js";


function requiredPlatesForDonate(order) {
  const p = DONATE_PACKS[order.pack_code];

  const requireCar =
    Boolean(order.selected_vehicle) || Boolean(p?.carInsurance);
  const requireBoat =
    Boolean(order.selected_boat) || Boolean(p?.boatInsurance);

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
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }

  const orderNo = interaction.customId.split(":")[1];
  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  if (order.status !== "APPROVED") {
    return safeReply(interaction, { content: "❌ ต้อง APPROVE ก่อนจึงจะ CLOSE ได้", ephemeral: true });
  }

  // ===== Validate plates (Rule A) =====
  if (order.type === "DONATE") {
    const { requireCar, requireBoat } = requiredPlatesForDonate(order);

    if (requireCar && !order.car_plate) {
      return safeReply(interaction, {
        content: "❌ ต้อง SET CAR PLATE (ทะเบียนรถ 6 หลัก) ก่อนปิดงาน",
        ephemeral: true
      });
    }
    if (requireBoat && !order.boat_plate) {
      return safeReply(interaction, {
        content: "❌ ต้อง SET BOAT PLATE (ทะเบียนเรือ 6 หลัก) ก่อนปิดงาน",
        ephemeral: true
      });
    }
  }

  // ===== Grant insurance at CLOSE (DONATE only) =====
  if (order.type === "DONATE") {
    const { pack: p } = requiredPlatesForDonate(order);

    // CAR insurance
    if (p?.carInsurance) {
      if (!order.car_plate) {
        return safeReply(interaction, {
          content: "❌ แพ็กนี้มีประกันรถ ต้อง SET CAR PLATE ก่อน",
          ephemeral: true
        });
      }

      await InsuranceRepo.upsertInsurance({
        plate: order.car_plate,
        kind: "CAR",
        add_total: p.carInsurance.total,   // ✅ accumulate
        days: p.carInsurance.days,         // ✅ extend expiry
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
      if (!order.boat_plate) {
        return safeReply(interaction, {
          content: "❌ แพ็กนี้มีประกันเรือ ต้อง SET BOAT PLATE ก่อน",
          ephemeral: true
        });
      }

      await InsuranceRepo.upsertInsurance({
        plate: order.boat_plate,
        kind: "BOAT",
        add_total: p.boatInsurance.total,  // ✅ accumulate
        days: p.boatInsurance.days,        // ✅ extend expiry
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

    // ===== Grant insurance at CLOSE (VIP) =====
  if (order.type === "VIP") {
    // ต้องมีทะเบียนรถเพื่อผูกประกัน
    if (!order.car_plate) {
      return safeReply(interaction, {
        content: "❌ VIP ต้อง SET CAR PLATE (ทะเบียนรถ 6 หลัก) ก่อนปิดงาน",
        ephemeral: true
      });
    }

    // ตั้งค่าประกัน VIP (ปรับเลข days ได้ตามต้องการ)
    // - BASIC/PRO: เพิ่มตามแพ็ก
    // - ELITE: unlimited -> +9999
    const vip = VIP_PACKS[order.pack_code];
    if (!vip) {
      return safeReply(interaction, { content: "❌ ไม่พบ VIP PACK", ephemeral: true });
    }

    const VIP_INS = {
      BASIC: { add_total: 5, days: 30 },
      PRO:   { add_total: 10, days: 30 },
      ELITE: { add_total: 999, days: 30 },
    };

    const cfg = VIP_INS[order.pack_code];
    if (!cfg) {
      return safeReply(interaction, { content: "❌ VIP แพ็กนี้ยังไม่ตั้งค่า Insurance", ephemeral: true });
    }

    await InsuranceRepo.upsertInsurance({
      plate: order.car_plate,
      kind: "CAR",
      add_total: cfg.add_total,  // ✅ สะสมเพิ่ม
      days: cfg.days,            // ✅ มี expire_at ทุกแพ็ก
      order_no: orderNo,
      source: "VIP_PACK",
    });

    await InsuranceRepo.log({
      guild_id: interaction.guildId,
      plate: order.car_plate,
      kind: "CAR",
      action: "GRANT",
      delta: cfg.add_total,
      order_no: orderNo,
      user_id: order.user_id,
      staff_id: interaction.user.id,
      note: `grant at CLOSE (VIP:${order.pack_code})`,
    });

    await refreshVehicleCard(interaction.client, order.car_plate, "CAR");
  }

  // ===== Archive attachments (all) =====
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
      car_plate: order.car_plate ?? null,
      boat_plate: order.boat_plate ?? null,
      attachments: attachments.length
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
