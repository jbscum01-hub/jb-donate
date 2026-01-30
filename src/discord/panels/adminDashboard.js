// src/discord/panels/adminDashboard.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { ENV } from "../../config/env.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";

function nowTH() {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

function n(v) {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
}

function fmtMoney(v) {
  return n(v).toLocaleString("en-US");
}

export async function buildAdminDashboardSnapshot(client) {
  const data = {
    totalAmount: 0,
    totalOrders: 0,
    todayAmount: 0,
    todayOrders: 0,

    pendingOrders: 0,
    approvedOrders: 0,
    deliveredOrders: 0,
    closedOrders: 0,
    canceledOrders: 0,

    queueCount: 0,
    notes: [],
  };

  // 1) Orders stats from DB
  try {
    if (!ENV.GUILD_ID) {
      data.notes.push("⚠️ Missing ENV.GUILD_ID (Dashboard stats may be 0)");
    } else {
      const s = await OrdersRepo.getDashboardStats(ENV.GUILD_ID);

      data.totalAmount = n(s.total_amount);
      data.totalOrders = n(s.total_orders);
      data.todayAmount = n(s.today_amount);
      data.todayOrders = n(s.today_orders);

      data.pendingOrders = n(s.pending_orders);
      data.approvedOrders = n(s.approved_orders);
      data.deliveredOrders = n(s.delivered_orders);
      data.closedOrders = n(s.closed_orders);
      data.canceledOrders = n(s.canceled_orders);
    }
  } catch (e) {
    data.notes.push(`⚠️ OrdersRepo stats error: ${e?.message || String(e)}`);
  }

  // 2) Queue / ticket rough count (best-effort)
  try {
    if (ENV.QUEUE_CHANNEL_ID) {
      const qch = await client.channels.fetch(ENV.QUEUE_CHANNEL_ID).catch(() => null);
      if (qch?.threads?.cache) {
        data.queueCount = qch.threads.cache.size;
      }
    }
  } catch (e) {
    // ไม่ critical
  }

  return data;
}

export async function buildAdminDashboardMessage(client) {
  const s = await buildAdminDashboardSnapshot(client);

  const embed = new EmbedBuilder()
    .setTitle("🛠️ Admin Dashboard")
    .setDescription("แผงควบคุมระบบ Donate / Ticket / VIP")
    .addFields(
      {
        name: "📊 Donate (รวม)",
        value: `ยอดรวม: **${fmtMoney(s.totalAmount)}**\nออเดอร์: **${fmtMoney(s.totalOrders)}**`,
        inline: true,
      },
      {
        name: "📅 วันนี้ (TH)",
        value: `ยอดวันนี้: **${fmtMoney(s.todayAmount)}**\nออเดอร์วันนี้: **${fmtMoney(s.todayOrders)}**`,
        inline: true,
      },
      {
        name: "📦 Orders Status",
        value:
          `PENDING: **${fmtMoney(s.pendingOrders)}**\n` +
          `APPROVED: **${fmtMoney(s.approvedOrders)}**\n` +
          `DELIVERED: **${fmtMoney(s.deliveredOrders)}**\n` +
          `CLOSED: **${fmtMoney(s.closedOrders)}**\n` +
          `CANCELED: **${fmtMoney(s.canceledOrders)}**`,
        inline: true,
      },
      {
        name: "🎟️ Queue / Ticket",
        value: `เธรดในห้องคิว: **${fmtMoney(s.queueCount)}**`,
        inline: true,
      },
      {
        name: "🧩 System",
        value:
          `ENV: **${process.env.RAILWAY_ENVIRONMENT_NAME || "local"}**\n` +
          `Updated: **${nowTH()}**`,
        inline: true,
      }
    );

  if (s.notes?.length) {
    embed.addFields({
      name: "⚠️ Notes",
      value: s.notes.slice(0, 5).join("\n"),
      inline: false,
    });
  }

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin:refresh")
      .setLabel("🔄 Refresh")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin:vip_tick")
      .setLabel("🟣 Run VIP Tick")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin:health")
      .setLabel("🟢 Health Check")
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin:rebuild_panels")
      .setLabel("🧱 Rebuild Panels")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin:rebuild_shop")
      .setLabel("🛒 Rebuild Shop Panel")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin:show_env")
      .setLabel("🔐 Show Config")
      .setStyle(ButtonStyle.Danger)
  );

  return { content: "", embeds: [embed], components: [row1, row2] };
}
