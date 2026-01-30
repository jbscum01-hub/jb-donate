// src/discord/panels/adminDashboard.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ENV } from "../../config/env.js";

// TODO: ถ้าคุณมี repo/db อยู่แล้ว ให้ import มาแทนด้านล่าง
// import { OrdersRepo } from "../../db/repo/orders.repo.js";
// import { VipRepo } from "../../db/repo/vip.repo.js";

function nowTH() {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

export async function buildAdminDashboardSnapshot(client) {
  // ✅ ค่าเริ่มต้นแบบ “ไม่พึ่ง DB” ก่อน (กันพัง)
  // ต่อไปค่อยเสียบ DB จริง
  const data = {
    totalAmount: 0,
    totalOrders: 0,
    todayAmount: 0,
    todayOrders: 0,
    vipDueSoon: 0,
    vipExpired: 0,
    vipWarn: 0,
    queueCount: 0,
  };

  // --- ตัวอย่าง “เสียบ DB” (คุณค่อยปรับให้ตรงตารางจริง)
  // try {
  //   const s = await OrdersRepo.getDashboardStats();
  //   Object.assign(data, s);
  // } catch (e) {
  //   console.warn("Dashboard OrdersRepo not ready:", e?.message || e);
  // }
  //
  // try {
  //   const v = await VipRepo.getVipStats();
  //   data.vipDueSoon = v.dueSoon;
  //   data.vipExpired = v.expired;
  //   data.vipWarn = v.warn;
  // } catch (e) {
  //   console.warn("Dashboard VipRepo not ready:", e?.message || e);
  // }

  // ✅ ดึงสถานะห้อง queue แบบเบา ๆ (ถ้าห้องมี thread/ticket เยอะค่อยปรับ)
  try {
    if (ENV.QUEUE_CHANNEL_ID) {
      const qch = await client.channels.fetch(ENV.QUEUE_CHANNEL_ID).catch(() => null);
      if (qch) data.queueCount = (qch.threads?.cache?.size || 0);
    }
  } catch {}

  return data;
}

export async function buildAdminDashboardMessage(client) {
  const s = await buildAdminDashboardSnapshot(client);

  const embed = new EmbedBuilder()
    .setTitle("🛠️ Admin Dashboard")
    .setDescription("แผงควบคุมระบบ Donate / Ticket / VIP")
    .addFields(
      { name: "📊 Donate (รวม)", value: `ยอดรวม: **${s.totalAmount.toLocaleString()}**\nออเดอร์: **${s.totalOrders.toLocaleString()}**`, inline: true },
      { name: "📅 วันนี้", value: `ยอดวันนี้: **${s.todayAmount.toLocaleString()}**\nออเดอร์วันนี้: **${s.todayOrders.toLocaleString()}**`, inline: true },
      { name: "👑 VIP", value: `ใกล้หมด: **${s.vipDueSoon}**\nเตือน: **${s.vipWarn}**\nหมดอายุ: **${s.vipExpired}**`, inline: true },
      { name: "🎟️ Queue / Ticket", value: `คิว/เธรดในห้อง: **${s.queueCount}**`, inline: true },
      { name: "🧩 System", value: `ENV: **${process.env.RAILWAY_ENVIRONMENT_NAME || "local"}**\nอัปเดตล่าสุด: **${nowTH()}**`, inline: true },
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:refresh").setLabel("🔄 Refresh").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("admin:vip_tick").setLabel("🟣 Run VIP Tick").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:health").setLabel("🟢 Health Check").setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:rebuild_panels").setLabel("🧱 Rebuild Panels").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:show_env").setLabel("🔐 Show Config").setStyle(ButtonStyle.Danger),
  );

  return { content: "", embeds: [embed], components: [row1, row2] };
}
