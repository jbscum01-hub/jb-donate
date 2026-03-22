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
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { CashLedgerRepo } from "../../db/repo/cashLedger.repo.js";

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

function fmtDateTH(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  } catch {
    return "-";
  }
}

function mainNavRow(active = "dashboard") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:nav:dashboard").setLabel("Dashboard").setEmoji("📊").setStyle(active === "dashboard" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:nav:packs").setLabel("Manage Packs").setEmoji("📦").setStyle(active === "packs" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:nav:insurance").setLabel("Insurance Tools").setEmoji("🛡️").setStyle(active === "insurance" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:nav:config").setLabel("System Config").setEmoji("⚙️").setStyle(active === "config" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:nav:logs").setLabel("Logs / Audit").setEmoji("📜").setStyle(active === "logs" ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

function footerRow(view = "dashboard") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:nav:tools").setLabel("Panel Tools").setEmoji("🛠️").setStyle(view === "tools" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:search:open").setLabel("Admin Search").setEmoji("🔎").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("admin:refresh").setLabel("Refresh").setEmoji("🔄").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("admin:vip_tick").setLabel("VIP Tick").setEmoji("👑").setStyle(ButtonStyle.Secondary),
  );
}

function packsActionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:packs:create").setLabel("Create Pack").setEmoji("➕").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:packs:edit").setLabel("Edit Pack").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:packs:edit_contents").setLabel("Edit Contents").setEmoji("🧩").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("admin:packs:image").setLabel("Image / Color").setEmoji("🖼️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:packs:toggle").setLabel("Enable / Disable").setEmoji("✅").setStyle(ButtonStyle.Secondary),
  );
}

function packsToolsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:packs:preview").setLabel("Preview Pack").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:packs:refresh").setLabel("Refresh Shop").setEmoji("♻️").setStyle(ButtonStyle.Secondary),
  );
}

function insuranceActionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:add_insurance:CAR").setLabel("Register Car Insurance").setEmoji("🚗").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("admin:add_insurance:BOAT").setLabel("Register Boat Insurance").setEmoji("🛥️").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("admin:insurance:search").setLabel("Search Insurance").setEmoji("🔍").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:insurance:cancel").setLabel("Cancel Insurance").setEmoji("❌").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:insurance:rebuild").setLabel("Rebuild Card").setEmoji("♻️").setStyle(ButtonStyle.Secondary),
  );
}

function configActionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:config:shop").setLabel("Shop Channel").setEmoji("🛒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:config:queue").setLabel("Queue Channel").setEmoji("🧾").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:config:logs").setLabel("Log Channel").setEmoji("📜").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:config:insurance").setLabel("Insurance Channel").setEmoji("🛡️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:config:role").setLabel("Staff Role").setEmoji("👮").setStyle(ButtonStyle.Secondary),
  );
}

function logsActionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:logs:recent").setLabel("Recent Logs").setEmoji("📌").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:logs:pack").setLabel("Pack Changes").setEmoji("📦").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:logs:insurance").setLabel("Insurance Logs").setEmoji("🛡️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:logs:config").setLabel("Config Changes").setEmoji("⚙️").setStyle(ButtonStyle.Secondary),
  );
}

function toolsActionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:tool:post_shop").setLabel("Deploy Shop Panel").setEmoji("🚀").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:tool:refresh_shop").setLabel("Refresh Shop Panel").setEmoji("♻️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:tool:deploy_admin").setLabel("Deploy Admin Panel").setEmoji("🧰").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:tool:rebuild_admin").setLabel("Rebuild Panel").setEmoji("🗂️").setStyle(ButtonStyle.Secondary),
  );
}

function searchActionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:search:open").setLabel("Admin Search").setEmoji("🔎").setStyle(ButtonStyle.Primary),
  );
}

function cashActionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:cash:summary").setLabel("ยอดเงินรวม").setEmoji("💰").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("admin:cash:add").setLabel("เพิ่มเงินเข้า").setEmoji("➕").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:cash:withdraw").setLabel("เบิกเงินออก").setEmoji("➖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("admin:cash:history").setLabel("ประวัติการเงิน").setEmoji("📜").setStyle(ButtonStyle.Secondary),
  );
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
    cash: { donated: 0, manualIn: 0, withdrawn: 0, balance: 0, txCount: 0, lastTxAt: null, ready: false },
    notes: [],
  };

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
      const cash = await CashLedgerRepo.getSummary(ENV.GUILD_ID);
      data.cash = {
        donated: data.totalAmount,
        manualIn: n(cash.total_in),
        withdrawn: n(cash.total_out),
        balance: data.totalAmount + n(cash.total_in) - n(cash.total_out),
        txCount: n(cash.tx_count),
        lastTxAt: cash.last_tx_at || null,
        ready: Boolean(cash.ready),
      };
      if (!cash.ready) {
        data.notes.push("ℹ️ Cash ledger ยังไม่พร้อม — รัน scripts/create_cash_ledger.sql ก่อนเพื่อใช้ปุ่มการเงินใหม่");
      }
    }
  } catch (e) {
    data.notes.push(`⚠️ Dashboard stats error: ${e?.message || String(e)}`);
  }

  void client;
  return data;
}

function buildDashboardEmbed(s) {
  const topPacksTxt = s.topPacks7d?.length
    ? s.topPacks7d
        .map((r, i) => `${i + 1}. **${r.pack_code || "(unknown)"}** — ${fmtMoney(r.amount)} (${fmtMoney(r.orders)} orders)`)
        .join("\n")
    : "-";

  const recentTxt = s.recentOrders?.length
    ? s.recentOrders
        .map((r) => `#${r.order_no} • ${r.type}/${r.pack_code} • **${r.status}** • ${fmtMoney(r.amount)} • ${r.user_tag || "-"} • ${fmtDateTH(r.created_th)}`)
        .slice(0, 5)
        .join("\n")
    : "-";

  const vipSoonTxt = s.vipExpiringSoon?.length
    ? s.vipExpiringSoon
        .map((v) => `<@${v.user_id}> • **${v.vip_code}** • หมดอายุ: ${fmtDateTH(v.expire_at)}`)
        .join("\n")
    : "-";

  const insSoonTxt = s.insurance?.soon?.length
    ? s.insurance.soon
        .map((p) => `**${p.plate}** (${p.kind}) • ใช้ไป ${fmtMoney(p.used)}/${fmtMoney(p.total)} • หมดอายุ: ${fmtDateTH(p.expire_at)}`)
        .join("\n")
    : "-";

  const notesTxt = s.notes?.length ? s.notes.join("\n") : "-";

  return new EmbedBuilder()
    .setColor(0x2b2d31)
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
        value: `PENDING: **${fmtMoney(s.pendingOrders)}**\nAPPROVED: **${fmtMoney(s.approvedOrders)}**\nSUCCESS: **${fmtMoney(s.successOrders)}**\nCANCELLED: **${fmtMoney(s.cancelledOrders)}**`,
        inline: true,
      },
      {
        name: "🎟️ Queue / Ticket",
        value: `ออเดอร์เปิดอยู่: **${fmtMoney(s.queueCount)}**`,
        inline: true,
      },
      {
        name: "🧩 System",
        value: `ENV: **${process.env.RAILWAY_ENVIRONMENT_NAME || "local"}**\nUpdated: **${nowTH()}**`,
        inline: true,
      },
      {
        name: "🧾 Today Breakdown",
        value: `DONATE: **${fmtMoney(s.todayByType.donateAmount)}** (${fmtMoney(s.todayByType.donateOrders)})\nVIP: **${fmtMoney(s.todayByType.vipAmount)}** (${fmtMoney(s.todayByType.vipOrders)})\nBOOST: **${fmtMoney(s.todayByType.boostAmount)}** (${fmtMoney(s.todayByType.boostOrders)})`,
        inline: true,
      },
      {
        name: "📦 Today Status",
        value: `PENDING: **${fmtMoney(s.todayStatus.pending)}**\nAPPROVED: **${fmtMoney(s.todayStatus.approved)}**\nSUCCESS: **${fmtMoney(s.todayStatus.success)}**\nCANCELLED: **${fmtMoney(s.todayStatus.cancelled)}**`,
        inline: true,
      },
      {
        name: "⏳ Pending Aging",
        value: `ค้างเกิน 24 ชม.: **${fmtMoney(s.pendingOver24h)}**\nค้างเก่าสุด (TH): **${fmtDateTH(s.oldestPendingTH)}**`,
        inline: true,
      },
      {
        name: "👑 VIP",
        value: `Active: **${fmtMoney(s.vip.active)}**\nDue grants: **${fmtMoney(s.vip.due_grants)}**\nExpiring 24h: **${fmtMoney(s.vip.expiring_24h)}**\nExpiring 3d: **${fmtMoney(s.vip.expiring_3d)}**\nExpired: **${fmtMoney(s.vip.expired)}**`,
        inline: true,
      },
      {
        name: "🛡️ Insurance",
        value: `Active: **${fmtMoney(s.insurance.active)}**\nExhausted: **${fmtMoney(s.insurance.exhausted)}**\nExpiring 24h: **${fmtMoney(s.insurance.expiring_24h)}**\nExpiring 3d: **${fmtMoney(s.insurance.expiring_3d)}**\nExpired: **${fmtMoney(s.insurance.expired)}**`,
        inline: true,
      },
      {
        name: "🔥 Top Packs (7d)",
        value: topPacksTxt,
        inline: false,
      },
      {
        name: "🕘 Recent Orders",
        value: recentTxt,
        inline: false,
      },
      {
        name: "⏰ VIP Expiring (24h)",
        value: vipSoonTxt,
        inline: false,
      },
      {
        name: "🪪 Insurance Expiring Soon",
        value: insSoonTxt,
        inline: false,
      },
      {
        name: "📌 Notes",
        value: notesTxt,
        inline: false,
      }
    );
}

function buildSimpleEmbed({ title, description, color = 0x2b2d31, fields = [] }) {
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
  if (fields.length) embed.addFields(fields);
  embed.setFooter({ text: `Updated ${nowTH()}` });
  return embed;
}

export async function buildAdminDashboardMessage(client, view = "dashboard") {
  const components = [mainNavRow(view), footerRow(view)];

  if (view === "dashboard") {
    components.splice(1, 0, cashActionsRow());
    const snapshot = await buildAdminDashboardSnapshot(client);
    return { embeds: [buildDashboardEmbed(snapshot)], components };
  }

  if (view === "packs") {
    components.splice(1, 0, packsActionsRow(), packsToolsRow());
    return {
      embeds: [
        buildSimpleEmbed({
          title: "📦 Manage Packs",
          description: "จัดการแพ็กทั้งหมดจากเมนูนี้\n\nตอนนี้เปิดโครงเมนูพร้อมปุ่มไว้แล้ว เพื่อให้หน้าแอดมินสมบูรณ์และไม่กดแล้วพัง\n\nสิ่งที่ใช้ได้ทันทีตอนนี้คือ **Refresh Shop Panel** ผ่าน Panel Tools หรือปุ่มในหน้านี้",
          fields: [
            { name: "พร้อมต่อยอด", value: "➕ Create Pack\n✏️ Edit Pack\n👁 Preview Pack\n✅ Enable / Disable Pack\n🗑 Delete Pack\n🔄 Refresh Shop Panel", inline: false },
          ],
        }),
      ],
      components,
    };
  }

  if (view === "insurance") {
    components.splice(1, 0, insuranceActionsRow());
    return {
      embeds: [
        buildSimpleEmbed({
          title: "🛡️ Insurance Tools",
          description: "ใช้ของเดิมในระบบเป็นฐาน และคง flow เดิมที่ลงทะเบียนแล้วสร้าง Vehicle / Boat Card พร้อมปุ่มใช้ประกันทันที",
          fields: [
            { name: "Manual Insurance Modal", value: "Player (mention หรือ user id)\nPlate\nModel\nจำนวนครั้ง\nจำนวนวัน", inline: false },
            { name: "ใช้งานได้ทันที", value: "🚗 Register Car Insurance\n🛥 Register Boat Insurance", inline: false },
            { name: "เตรียมไว้ต่อยอด", value: "🔍 Search Insurance\n❌ Cancel Insurance\n♻️ Rebuild Insurance Card", inline: false },
          ],
        }),
      ],
      components,
    };
  }

  if (view === "config") {
    components.splice(1, 0, configActionsRow());
    return {
      embeds: [
        buildSimpleEmbed({
          title: "⚙️ System Config",
          description: "หน้าตั้งค่าระบบหลักผ่าน Discord โดยอิงค่า ENV / config table ของระบบ",
          fields: [
            { name: "รายการที่ต้องมี", value: "🛒 Shop Channel\n🧾 Queue Channel\n📦 Archive Channel\n📜 Log Channel\n👮 Staff Role\n🛡 Insurance Card Channel", inline: false },
            { name: "สถานะ", value: "หน้านี้เปิดโครงเมนูและปุ่มไว้แล้ว เพื่อกดแล้วไม่พัง และพร้อมต่อยอดเป็น modal / select menu", inline: false },
          ],
        }),
      ],
      components,
    };
  }

  if (view === "logs") {
    components.splice(1, 0, logsActionsRow());
    return {
      embeds: [
        buildSimpleEmbed({
          title: "📜 Logs / Audit",
          description: "หน้าดูย้อนหลังของระบบ โดยอิง tb_donate_audit_logs และ log ตารางย่อยของ donate",
          fields: [
            { name: "รายการที่วางไว้", value: "📌 Recent Logs\n📦 Pack Changes\n🛡 Insurance Logs\n⚙️ Config Changes", inline: false },
            { name: "สถานะ", value: "ปุ่มในหน้านี้ใช้ดู log ล่าสุดได้แล้วแบบ ephemeral และดึงจาก DB จริง", inline: false },
          ],
        }),
      ],
      components,
    };
  }


  if (view === "search") {
    components.splice(1, 0, searchActionsRow());
    return {
      embeds: [
        buildSimpleEmbed({
          title: "🔎 Admin Search",
          description: "ค้นหาข้อมูลแอดมินจากจุดเดียว แล้วสรุป Orders / Insurance / Audit ให้ทันที",
          fields: [
            { name: "ค้นหาได้จาก", value: `Order No
Plate
Discord ID หรือ mention
Pack Code
IGN / User Tag`, inline: false },
            { name: "วิธีใช้", value: `กดปุ่ม Admin Search แล้วกรอก keyword
Mode เว้นว่างได้ ระบบจะใช้ AUTO`, inline: false },
          ],
        }),
      ],
      components,
    };
  }

  if (view === "tools") {
    components.splice(1, 0, toolsActionsRow());
    return {
      embeds: [
        buildSimpleEmbed({
          title: "🛠️ Panel Tools",
          description: "เครื่องมือ deploy / refresh panel แบบไม่ต้องไปแก้ข้อความมือใน Discord",
          fields: [
            { name: "ใช้งานได้ทันที", value: "🚀 Deploy Shop Panel\n♻️ Refresh Shop Panel\n🧰 Deploy Admin Panel\n🗂 Rebuild Panel", inline: false },
            { name: "หมายเหตุ", value: "Deploy Admin Panel จะสร้างข้อความใหม่ในห้องแอดมินและส่ง message id กลับมาให้", inline: false },
          ],
        }),
      ],
      components,
    };
  }

  const snapshot = await buildAdminDashboardSnapshot(client);
  return { embeds: [buildDashboardEmbed(snapshot)], components };
}
