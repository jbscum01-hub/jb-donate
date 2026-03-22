import {
  ActionRowBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { CashLedgerRepo } from "../../db/repo/cashLedger.repo.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { isAdmin } from "../../domain/permissions.js";
import { safeReply } from "../utils/messages.js";

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

async function getCashSummary(guildId) {
  const [orderStats, orderWindow, cashSummary, cashWindow] = await Promise.all([
    OrdersRepo.getDashboardStats(guildId),
    OrdersRepo.getWindowStats(guildId),
    CashLedgerRepo.getSummary(guildId),
    CashLedgerRepo.getWindowStats(guildId),
  ]);

  return {
    donated: n(orderStats?.total_amount),
    manualIn: n(cashSummary?.total_in),
    withdrawn: n(cashSummary?.total_out),
    balance: n(cashSummary?.current_balance),
    txCount: n(cashSummary?.tx_count),
    lastTxAt: cashSummary?.last_tx_at || null,
    ledgerReady: Boolean(cashSummary?.ready),
    donate7d: n(orderWindow?.amount_7d),
    orders7d: n(orderWindow?.orders_7d),
    donate30d: n(orderWindow?.amount_30d),
    orders30d: n(orderWindow?.orders_30d),
    avgOrder: n(orderWindow?.avg_order_amount),
    lastSuccessAt: orderWindow?.last_success_th || null,
    in7d: n(cashWindow?.in_7d),
    out7d: n(cashWindow?.out_7d),
    in30d: n(cashWindow?.in_30d),
    out30d: n(cashWindow?.out_30d),
  };
}

function buildCashSummaryEmbed(summary) {
  const note = summary.ledgerReady
    ? `รายการ ledger: **${fmtMoney(summary.txCount)}**\nอัปเดตล่าสุด: **${fmtDateTH(summary.lastTxAt)}**`
    : "ยังไม่พบตาราง cash ledger — รันสคริปต์ `scripts/create_cash_ledger.sql` ก่อน";

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("💰 ยอดเงินรวม")
    .setDescription("คำนวณจากยอดโดเนทที่สำเร็จ (`SUCCESS`) + เงินเพิ่มเข้า - เงินที่เบิกออก")
    .addFields(
      { name: "ยอดโดเนทรวม", value: `**${fmtMoney(summary.donated)}**`, inline: true },
      { name: "เพิ่มเงินเข้า", value: `**${fmtMoney(summary.manualIn)}**`, inline: true },
      { name: "เบิกเงินออก", value: `**${fmtMoney(summary.withdrawn)}**`, inline: true },
      { name: "ยอดคงเหลือ", value: `**${fmtMoney(summary.balance)}**`, inline: true },
      { name: "โดเนท 7 วัน", value: `**${fmtMoney(summary.donate7d)}** (${fmtMoney(summary.orders7d)} รายการ)`, inline: true },
      { name: "เงินเข้า/ออก 7 วัน", value: `+${fmtMoney(summary.in7d)} / -${fmtMoney(summary.out7d)}`, inline: true },
      { name: "โดเนท 30 วัน", value: `**${fmtMoney(summary.donate30d)}** (${fmtMoney(summary.orders30d)} รายการ)`, inline: true },
      { name: "เงินเข้า/ออก 30 วัน", value: `+${fmtMoney(summary.in30d)} / -${fmtMoney(summary.out30d)}`, inline: true },
      { name: "ค่าเฉลี่ยต่อออเดอร์", value: `**${fmtMoney(summary.avgOrder)}**`, inline: true },
      { name: "โดเนทล่าสุด", value: `**${fmtDateTH(summary.lastSuccessAt)}**`, inline: true },
      { name: "สถานะ", value: note, inline: false },
    )
    .setFooter({ text: `Updated ${fmtDateTH(new Date())}` });
}

function buildCashHistoryEmbed(rows, summary) {
  const desc = rows.length
    ? rows.map((r, i) => {
        const sign = r.txn_type === "OUT" ? "-" : "+";
        const who = r.actor_id ? `<@${r.actor_id}>` : (r.actor_tag || "-");
        const note = r.note ? `\n📝 ${r.note}` : "";
        const image = r.image_url ? `\n📸 [ลิงก์รูปหลักฐาน](${r.image_url})` : "";
        return `${i + 1}. **${sign}${fmtMoney(r.amount)}** • ${r.reason}\n👤 ${who}\n💼 คงเหลือหลังรายการ: **${fmtMoney(r.balance_after)}**\n🕒 ${fmtDateTH(r.created_at)}${note}${image}`;
      }).join("\n\n")
    : "- ยังไม่มีประวัติการเงิน";

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📜 ประวัติการเงิน")
    .setDescription(desc)
    .setFooter({ text: `ยอดคงเหลือปัจจุบัน ${fmtMoney(summary.balance)}` });
}


function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCashCsv(rows) {
  const headers = [
    "ledger_id",
    "guild_id",
    "txn_type",
    "amount",
    "balance_after",
    "reason",
    "note",
    "image_url",
    "actor_id",
    "actor_tag",
    "created_at",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.ledger_id,
      r.guild_id,
      r.txn_type,
      r.amount,
      r.balance_after,
      r.reason,
      r.note,
      r.image_url,
      r.actor_id,
      r.actor_tag,
      r.created_at ? new Date(r.created_at).toISOString() : "",
    ].map(csvEscape).join(","));
  }

  return Buffer.from(lines.join("\n"), "utf8");
}

function buildCashModal(kind) {
  const isOut = kind === "out";
  const rows = [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("จำนวนเงิน")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("เช่น 1000")
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("เหตุผล")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(isOut ? "เช่น ค่าใช้จ่ายเซิร์ฟเวอร์" : "เช่น เติมทุน / เงินเข้าระบบจริง")
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("note")
        .setLabel("หมายเหตุ")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder("ถ้ามี")
    ),
  ];

  if (isOut) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("image_url")
          .setLabel("ลิงก์รูปหลักฐาน (ไม่บังคับ)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("https://...")
      )
    );
  }

  return new ModalBuilder()
    .setCustomId(`admin:cash:modal:${kind}`)
    .setTitle(isOut ? "เบิกเงินออก" : "เพิ่มเงินเข้า")
    .addComponents(...rows);
}

export async function handleCashButton(interaction) {
  if (!interaction.isButton()) return;
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  const id = interaction.customId;

  if (id === "admin:cash:summary") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const summary = await getCashSummary(interaction.guildId);
    return safeReply(interaction, { embeds: [buildCashSummaryEmbed(summary)], ephemeral: true });
  }

  if (id === "admin:cash:history") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const [summary, rows] = await Promise.all([
      getCashSummary(interaction.guildId),
      CashLedgerRepo.listRecent(interaction.guildId, 10),
    ]);
    return safeReply(interaction, { embeds: [buildCashHistoryEmbed(rows, summary)], ephemeral: true });
  }

  if (id === "admin:cash:export") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const [summary, rows] = await Promise.all([
      getCashSummary(interaction.guildId),
      CashLedgerRepo.exportRows(interaction.guildId, 500),
    ]);
    const file = new AttachmentBuilder(buildCashCsv(rows), { name: `cash-ledger-${interaction.guildId || "global"}.csv` });
    const embed = new EmbedBuilder()
      .setColor(0x8e44ad)
      .setTitle("📤 ส่งออกรายงานเงิน")
      .setDescription(`แนบไฟล์ CSV รายการล่าสุด ${fmtMoney(rows.length)} รายการ`)
      .addFields(
        { name: "ยอดคงเหลือปัจจุบัน", value: `**${fmtMoney(summary.balance)}**`, inline: true },
        { name: "ยอดโดเนทรวม", value: `**${fmtMoney(summary.donated)}**`, inline: true },
        { name: "เงินเข้า / เงินออก", value: `+${fmtMoney(summary.manualIn)} / -${fmtMoney(summary.withdrawn)}`, inline: true },
      );
    return safeReply(interaction, { embeds: [embed], files: [file], ephemeral: true });
  }

  if (id === "admin:cash:add") {
    return interaction.showModal(buildCashModal("in"));
  }

  if (id === "admin:cash:withdraw") {
    return interaction.showModal(buildCashModal("out"));
  }
}

export async function handleCashModal(interaction) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith("admin:cash:modal:")) return;
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  const kind = interaction.customId.split(":").pop();
  const amountRaw = interaction.fields.getTextInputValue("amount");
  const reason = interaction.fields.getTextInputValue("reason");
  const note = interaction.fields.getTextInputValue("note") || null;
  const imageUrl = kind === "out"
    ? (interaction.fields.getTextInputValue("image_url") || "").trim() || null
    : null;
  const amount = Number(String(amountRaw || "").replace(/,/g, "").trim());

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const row = await CashLedgerRepo.addEntry({
    guildId: interaction.guildId,
    txnType: kind === "out" ? "OUT" : "IN",
    amount,
    reason,
    note,
    imageUrl,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag ?? interaction.user.username,
  });

  await AuditRepo.add({
    guildId: interaction.guildId,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag ?? interaction.user.username,
    action: kind === "out" ? "CASH_WITHDRAW" : "CASH_ADD",
    target: String(row.ledger_id),
    meta: {
      amount: Number(row.amount || 0),
      balance_after: Number(row.balance_after || 0),
      reason,
      note,
      image_url: imageUrl,
    },
  });

  const summary = await getCashSummary(interaction.guildId);
  const result = new EmbedBuilder()
    .setColor(kind === "out" ? 0xe67e22 : 0x2ecc71)
    .setTitle(kind === "out" ? "➖ เบิกเงินออกสำเร็จ" : "➕ เพิ่มเงินเข้าสำเร็จ")
    .addFields(
      { name: "จำนวน", value: `**${fmtMoney(row.amount)}**`, inline: true },
      { name: "เหตุผล", value: String(reason || "-"), inline: true },
      { name: "คงเหลือหลังรายการ", value: `**${fmtMoney(summary.balance)}**`, inline: true },
      { name: "หมายเหตุ", value: note || "-", inline: false },
    )
    .setFooter({ text: `บันทึกเมื่อ ${fmtDateTH(row.created_at || new Date())}` });

  if (imageUrl) result.setImage(imageUrl);

  return safeReply(interaction, { embeds: [result], ephemeral: true });
}
