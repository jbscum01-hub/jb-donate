// src/discord/panels/adminDashboard.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { ENV } from "../../config/env.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { VipRepo } from "../../db/repo/vip.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";

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
    successOrders: 0,
    cancelledOrders: 0,

    queueCount: 0,
    todayStatus: { pending: 0, approved: 0, success: 0, cancelled: 0 },
    todayByType: {
      donateAmount: 0,
      donateOrders: 0,
      vipAmount: 0,
      vipOrders: 0,
      boostAmount: 0,
      boostOrders: 0,
    },
    pendingOver24h: 0,
    oldestPendingTH: null,
    recentOrders: [],
    topPacks7d: [],
    vip: { active: 0, expiring_24h: 0, expiring_3d: 0, due_grants: 0, expired: 0 },
    vipExpiringSoon: [],
    insurance: { active: 0, expiring_24h: 0, expiring_3d: 0, exhausted: 0, expired: 0, soon: [] },
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
      data.successOrders = n(s.success_orders);
      data.cancelledOrders = n(s.cancelled_orders);

      const ex = await OrdersRepo.getDashboardExtra(ENV.GUILD_ID);
      data.todayStatus = {
        pending: n(ex.today_pending),
        approved: n(ex.today_approved),
        success: n(ex.today_success),
        cancelled: n(ex.today_cancelled),
      };
      data.todayByType = {
        donateAmount: n(ex.today_donate_amount),
        donateOrders: n(ex.today_donate_orders),
        vipAmount: n(ex.today_vip_amount),
        vipOrders: n(ex.today_vip_orders),
        boostAmount: n(ex.today_boost_amount),
        boostOrders: n(ex.today_boost_orders),
      };
      data.pendingOver24h = n(ex.pending_over_24h);
      data.oldestPendingTH = ex.oldest_pending_th || null;

      data.recentOrders = await OrdersRepo.getRecent(ENV.GUILD_ID, 5);
      data.topPacks7d = await OrdersRepo.getTopPacks7d(ENV.GUILD_ID, 5);

      data.vip = await VipRepo.getDashboardStats(ENV.GUILD_ID);
      data.vipExpiringSoon = await VipRepo.listExpiringSoon(ENV.GUILD_ID, 24, 5);

      data.insurance = await InsuranceRepo.getDashboardStats(5);
      data.queueCount = await OrdersRepo.getOpenQueueCount(ENV.GUILD_ID);
    }
  } catch (e) {
    data.notes.push(`⚠️ OrdersRepo stats error: ${e?.message || String(e)}`);
  }

  // 2) Keep client referenced so signature stays the same
  void client;

  return data;
}

export async function buildAdminDashboardMessage(client) {
  const s = await buildAdminDashboardSnapshot(client);

  const topPacksTxt = s.topPacks7d?.length
    ? s.topPacks7d
        .map((r, i) => `${i + 1}. **${r.pack_code || "(unknown)"}** — ${fmtMoney(r.amount)} (${fmtMoney(r.orders)} orders)`)
        .join("\n")
    : "-";

  const recentTxt = s.recentOrders?.length
    ? s.recentOrders
        .map((r) => {
          const when = r.created_th ? new Date(r.created_th).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "-";
          return `#${r.order_no} • ${r.type}/${r.pack_code} • **${r.status}** • ${fmtMoney(r.amount)} • ${r.user_tag || "-"} • ${when}`;
        })
        .slice(0, 5)
        .join("\n")
    : "-";

  const vipSoonTxt = s.vipExpiringSoon?.length
    ? s.vipExpiringSoon
        .map((v) => {
          const when = v.expire_at ? new Date(v.expire_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "-";
          return `<@${v.user_id}> • **${v.vip_code}** • หมดอายุ: ${when}`;
        })
        .join("\n")
    : "-";

  const insSoonTxt = s.insurance?.soon?.length
    ? s.insurance.soon
        .map((p) => {
          const when = p.expire_at ? new Date(p.expire_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "-";
          return `**${p.plate}** (${p.kind}) • ใช้ไป ${fmtMoney(p.used)}/${fmtMoney(p.total)} • หมดอายุ: ${when}`;
        })
        .join("\n")
    : "-";

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("🛠️ Admin Dashboard")
    .setDescription("แผงควบคุมระบบ Donate / Ticket / VIP")
    .addFields(
      {
        name: "📊 Donate (รวม)",
        value: `ยอดรวม: **${fmtMoney(s.totalAmount)}**
ออเดอร์: **${fmtMoney(s.totalOrders)}**`,
        inline: true,
      },
      {
        name: "📅 วันนี้ (TH)",
        value: `ยอดวันนี้: **${fmtMoney(s.todayAmount)}**
ออเดอร์วันนี้: **${fmtMoney(s.todayOrders)}**`,
        inline: true,
      },
      {
        name: "📦 Orders Status",
        value:
          `PENDING: **${fmtMoney(s.pendingOrders)}**
` +
          `APPROVED: **${fmtMoney(s.approvedOrders)}**
` +
          `SUCCESS: **${fmtMoney(s.successOrders)}**
` +
          `CANCELLED: **${fmtMoney(s.cancelledOrders)}**`,
        inline: true,
      },
      {
        name: "🎟️ Queue / Ticket",
        value: `ออเดอร์เปิดอยู่: **${fmtMoney(s.queueCount)}**`,
        inline: true,
      },
      {
        name: "🧩 System",
        value:
          `ENV: **${process.env.RAILWAY_ENVIRONMENT_NAME || "local"}**
` +
          `Updated: **${nowTH()}**`,
        inline: true,
      }
    )
    .addFields(
      {
        name: "🧾 Today Breakdown",
        value:
          `DONATE: **${fmtMoney(s.todayByType.donateAmount)}** (${fmtMoney(s.todayByType.donateOrders)})
` +
          `VIP: **${fmtMoney(s.todayByType.vipAmount)}** (${fmtMoney(s.todayByType.vipOrders)})
` +
          `BOOST: **${fmtMoney(s.todayByType.boostAmount)}** (${fmtMoney(s.todayByType.boostOrders)})`,
        inline: true,
      },
      {
        name: "📦 Today Status",
        value:
          `PENDING: **${fmtMoney(s.todayStatus.pending)}**
` +
          `APPROVED: **${fmtMoney(s.todayStatus.approved)}**
` +
          `SUCCESS: **${fmtMoney(s.todayStatus.success)}**
` +
          `CANCELLED: **${fmtMoney(s.todayStatus.cancelled)}**`,
        inline: true,
      },
      {
        name: "⏳ Pending Aging",
        value:
          `ค้างเกิน 24 ชม.: **${fmtMoney(s.pendingOver24h)}**
` +
          `ค้างเก่าสุด (TH): **${s.oldestPendingTH ? new Date(s.oldestPendingTH).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "-"}**`,
        inline: true,
      },
      {
        name: "👑 VIP",
        value:
          `Active: **${fmtMoney(s.vip.active)}**
` +
          `Due grants: **${fmtMoney(s.vip.due_grants)}**
` +
          `Expiring 24h: **${fmtMoney(s.vip.expiring_24h)}**
` +
          `Expiring 3d: **${fmtMoney(s.vip.expiring_3d)}**
` +
          `Expired: **${fmtMoney(s.vip.expired)}**`,
        inline: true,
      },
      {
        name: "🚗 Insurance",
        value:
          `Active: **${fmtMoney(s.insurance.active)}**
` +
          `Exhausted: **${fmtMoney(s.insurance.exhausted)}**
` +
          `Expiring 24h: **${fmtMoney(s.insurance.expiring_24h)}**
` +
          `Expiring 3d: **${fmtMoney(s.insurance.expiring_3d)}**
` +
          `Expired: **${fmtMoney(s.insurance.expired)}**`,
        inline: true,
      },
      {
        name: "🔥 Top Packs (7d)",
        value: topPacksTxt,
        inline: false,
      },
      {
        name: "🕘 Recent Orders",
        value: recentTxt.length > 1024 ? `${recentTxt.slice(0, 1000)}…` : recentTxt,
        inline: false,
      },
      {
        name: "⏰ VIP Expiring (24h)",
        value: vipSoonTxt.length > 1024 ? `${vipSoonTxt.slice(0, 1000)}…` : vipSoonTxt,
        inline: false,
      },
      {
        name: "🪪 Insurance Expiring Soon",
        value: insSoonTxt.length > 1024 ? `${insSoonTxt.slice(0, 1000)}…` : insSoonTxt,
        inline: false,
      }
    );

  if (s.notes?.length) {
    embed.addFields({
      name: "⚠️ Notes",
      value: s.notes.join("\n").slice(0, 1024),
      inline: false,
    });
  }

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("admin_dashboard_refresh")
        .setLabel("Refresh Dashboard")
        .setStyle(ButtonStyle.Primary)
    ),
  ];

  return { embeds: [embed], components: rows };
}
