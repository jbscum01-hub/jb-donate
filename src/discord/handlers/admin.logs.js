import { EmbedBuilder, MessageFlags } from "discord.js";

import { isAdmin } from "../../domain/permissions.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { safeReply } from "../utils/messages.js";

function fmtDateTH(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  } catch {
    return "-";
  }
}

function shortMeta(meta) {
  if (!meta) return "";
  if (typeof meta === "string") return meta.length > 110 ? `${meta.slice(0, 107)}...` : meta;
  if (typeof meta !== "object") return String(meta);

  const parts = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === "") continue;
    const value = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}=${value}`);
    if (parts.join(" | ").length > 110) break;
  }

  const joined = parts.join(" | ");
  return joined.length > 110 ? `${joined.slice(0, 107)}...` : joined;
}

function buildAuditEmbed(title, color, rows, emptyText) {
  const description = rows?.length
    ? rows
        .map((r, i) => {
          const who = r.actor_id ? `<@${r.actor_id}>` : (r.actor_tag || "-");
          const target = r.target ? ` • ${r.target}` : "";
          const meta = shortMeta(r.meta);
          return `${i + 1}. **${r.action || "-"}**${target}\n👤 ${who}\n🕒 ${fmtDateTH(r.created_at)}${meta ? `\n🧩 ${meta}` : ""}`;
        })
        .join("\n\n")
    : emptyText;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `Updated ${fmtDateTH(new Date())}` });
}

function buildInsuranceLogEmbed(rows) {
  const description = rows?.length
    ? rows
        .map((r, i) => {
          const who = r.staff_id ? `<@${r.staff_id}>` : (r.user_id ? `<@${r.user_id}>` : "-");
          const delta = Number(r.delta || 0);
          const deltaText = delta > 0 ? `+${delta}` : String(delta);
          return `${i + 1}. **${r.action || "-"}** • ${r.plate}/${r.kind}\n👤 ${who}\n🕒 ${fmtDateTH(r.created_at)} • Δ ${deltaText}${r.note ? `\n📝 ${r.note}` : ""}`;
        })
        .join("\n\n")
    : "- ยังไม่มี Insurance Logs";

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🛡️ Insurance Logs")
    .setDescription(description)
    .setFooter({ text: `Updated ${fmtDateTH(new Date())}` });
}

export async function handleLogsAdminButton(interaction) {
  if (!interaction.isButton()) return;
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  if (interaction.customId === "admin:logs:recent") {
    const rows = await AuditRepo.listRecent(10);
    return safeReply(interaction, {
      embeds: [buildAuditEmbed("📌 Recent Audit Logs", 0x2ecc71, rows, "- ยังไม่มี Audit Logs")],
      ephemeral: true,
    });
  }

  if (interaction.customId === "admin:logs:pack") {
    const rows = await AuditRepo.listByActionPrefixes(["PACK_"], 10);
    return safeReply(interaction, {
      embeds: [buildAuditEmbed("📦 Pack Changes", 0xf1c40f, rows, "- ยังไม่มีประวัติการแก้ Pack")],
      ephemeral: true,
    });
  }

  if (interaction.customId === "admin:logs:insurance") {
    const auditRows = await AuditRepo.listByActionPrefixes(["INSURANCE_", "VEHICLE_"], 6);
    const insRows = await InsuranceRepo.listRecentLogs(6);
    return safeReply(interaction, {
      embeds: [
        buildInsuranceLogEmbed(insRows),
        buildAuditEmbed("🧾 Insurance Audit", 0x5865f2, auditRows, "- ยังไม่มี Audit ฝั่ง Insurance"),
      ],
      ephemeral: true,
    });
  }

  if (interaction.customId === "admin:logs:config") {
    const rows = await AuditRepo.listByActionPrefixes(["SHOP_PANEL_", "ADMIN_PANEL_", "CONFIG_"], 10);
    return safeReply(interaction, {
      embeds: [buildAuditEmbed("⚙️ Panel / Config Changes", 0x95a5a6, rows, "- ยังไม่มีประวัติการเปลี่ยนค่า panel/config")],
      ephemeral: true,
    });
  }

  return safeReply(interaction, { content: "ℹ️ Logs action not implemented", ephemeral: true });
}
