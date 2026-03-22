import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { safeReply } from "../utils/messages.js";

function fmtDateTH(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  } catch {
    return "-";
  }
}

function cleanText(v) {
  return String(v || "").trim();
}

function cleanUpper(v) {
  return cleanText(v).toUpperCase();
}

function parseSearchMode(v) {
  const s = cleanUpper(v);
  if (["AUTO", "ORDER", "PLATE", "USER", "PACK"].includes(s)) return s;
  return "AUTO";
}

function normalizeKeyword(v) {
  return cleanText(v).replace(/^<@!?(\d+)>$/, "$1");
}

function money(v) {
  return Number(v || 0).toLocaleString("en-US");
}

function shorten(v, max = 120) {
  const s = cleanText(v);
  return s.length > max ? `${s.slice(0, max - 3)}...` : s || "-";
}

function openSearchModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("admin:search:modal:run")
    .setTitle("Admin Search");

  const keyword = new TextInputBuilder()
    .setCustomId("keyword")
    .setLabel("Keyword")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("order no / plate / discord id / pack code / ign");

  const mode = new TextInputBuilder()
    .setCustomId("mode")
    .setLabel("Mode (AUTO/ORDER/PLATE/USER/PACK)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder("เว้นว่าง = AUTO");

  modal.addComponents(
    new ActionRowBuilder().addComponents(keyword),
    new ActionRowBuilder().addComponents(mode),
  );

  return interaction.showModal(modal);
}

function buildSummaryEmbed({ keyword, mode, orders, insurances, audits }) {
  const firstOrder = orders[0] || null;
  const firstInsurance = insurances[0] || null;
  const firstAudit = audits[0] || null;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🔎 Admin Search • ${keyword}`)
    .setDescription(`Mode: **${mode}**\nผลค้นหาแบบรวมจาก Orders / Insurance / Audit`)
    .addFields(
      { name: "Orders", value: String(orders.length), inline: true },
      { name: "Insurance", value: String(insurances.length), inline: true },
      { name: "Audit", value: String(audits.length), inline: true },
      {
        name: "Quick Peek",
        value: [
          firstOrder ? `Order ล่าสุด: **#${firstOrder.order_no}** • ${firstOrder.status} • ${firstOrder.pack_code || "-"}` : null,
          firstInsurance ? `Insurance ล่าสุด: **${firstInsurance.plate}**/${firstInsurance.kind} • เหลือ ${firstInsurance.remaining}/${firstInsurance.total}` : null,
          firstAudit ? `Audit ล่าสุด: **${firstAudit.action}** • ${fmtDateTH(firstAudit.created_at)}` : null,
        ].filter(Boolean).join("\n") || "- ไม่พบข้อมูล",
        inline: false,
      },
    )
    .setFooter({ text: `Updated ${fmtDateTH(new Date())}` });
}

function buildOrdersEmbed(rows) {
  const description = rows.length
    ? rows.map((r, i) => [
        `${i + 1}. **#${r.order_no}** • ${r.status} • ${r.type || "-"}/${r.pack_code || "-"}`,
        `👤 ${r.user_id ? `<@${r.user_id}>` : "-"} • ${shorten(r.user_tag || r.ign || "-")}`,
        `💸 ${money(r.amount)} • 🕒 ${fmtDateTH(r.created_at)}`,
        `🚗 ${r.car_plate || r.plate || "-"} • 🛥️ ${r.boat_plate || "-"}`,
      ].join("\n")).join("\n\n")
    : "- ไม่พบ Order";

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🧾 Orders")
    .setDescription(description)
    .setFooter({ text: `Updated ${fmtDateTH(new Date())}` });
}

function buildInsuranceEmbed(rows) {
  const description = rows.length
    ? rows.map((r, i) => [
        `${i + 1}. **${r.plate}** / ${r.kind}`,
        `👤 ${r.owner_user_id ? `<@${r.owner_user_id}>` : "-"} • ${shorten(r.owner_tag || "-")}`,
        `📦 ${r.model || "-"} • เหลือ **${r.remaining}**/**${r.total}** • ใช้ไป ${r.used}`,
        `⏳ ${fmtDateTH(r.expire_at)} • Order: ${r.order_no || "-"}`,
      ].join("\n")).join("\n\n")
    : "- ไม่พบ Insurance";

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🛡️ Insurance / Vehicle")
    .setDescription(description)
    .setFooter({ text: `Updated ${fmtDateTH(new Date())}` });
}

function buildAuditEmbed(rows) {
  const description = rows.length
    ? rows.map((r, i) => {
        const who = r.actor_id ? `<@${r.actor_id}>` : (r.actor_tag || "-");
        const meta = r.meta && typeof r.meta === "object"
          ? Object.entries(r.meta).slice(0, 3).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(" | ")
          : shorten(r.meta || "", 90);
        return `${i + 1}. **${r.action}**${r.target ? ` • ${r.target}` : ""}\n👤 ${who}\n🕒 ${fmtDateTH(r.created_at)}${meta ? `\n🧩 ${shorten(meta, 120)}` : ""}`;
      }).join("\n\n")
    : "- ไม่พบ Audit";

  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("📜 Related Audit")
    .setDescription(description)
    .setFooter({ text: `Updated ${fmtDateTH(new Date())}` });
}

export async function handleAdminSearchButton(interaction) {
  if (!interaction.isButton()) return;
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  if (interaction.customId === "admin:search:open") {
    return openSearchModal(interaction);
  }

  return safeReply(interaction, { content: "ℹ️ Search action not implemented", ephemeral: true });
}

export async function handleAdminSearchModal(interaction) {
  if (!interaction.isModalSubmit()) return;
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  const keyword = normalizeKeyword(interaction.fields.getTextInputValue("keyword"));
  const mode = parseSearchMode(interaction.fields.getTextInputValue("mode"));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const [orders, insurances, audits] = await Promise.all([
    OrdersRepo.adminSearch(keyword, interaction.guildId, mode, 6),
    InsuranceRepo.adminSearch(keyword, mode, 6),
    AuditRepo.adminSearch(keyword, interaction.guildId, mode, 6),
  ]);

  return safeReply(interaction, {
    embeds: [
      buildSummaryEmbed({ keyword, mode, orders, insurances, audits }),
      buildOrdersEmbed(orders),
      buildInsuranceEmbed(insurances),
      buildAuditEmbed(audits),
    ],
    ephemeral: true,
  });
}
