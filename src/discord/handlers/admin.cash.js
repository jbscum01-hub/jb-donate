import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  const [orderStats, cashSummary] = await Promise.all([
    OrdersRepo.getDashboardStats(guildId),
    CashLedgerRepo.getSummary(guildId),
  ]);

  const donated = n(orderStats?.total_amount);
  const withdrawn = n(cashSummary?.total_out);
  const manualIn = n(cashSummary?.total_in);
  return {
    donated,
    withdrawn,
    manualIn,
    balance: donated + manualIn - withdrawn,
    txCount: n(cashSummary?.tx_count),
    lastTxAt: cashSummary?.last_tx_at || null,
    ledgerReady: Boolean(cashSummary?.ready),
  };
}

function buildCashSummaryEmbed(summary) {
  const note = summary.ledgerReady
    ? `รายการ ledger: **${fmtMoney(summary.txCount)}**\nอัปเดตล่าสุด: **${fmtDateTH(summary.lastTxAt)}**`
    : "ยังไม่พบตาราง cash ledger — รันสคริปต์ `scripts/create_cash_ledger.sql` ก่อน";

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("💰 ยอดเงินรวม")
    .setDescription("สรุปจากยอดโดเนทที่สำเร็จ (`SUCCESS`) และรายการเบิก/เติมเงินจาก cash ledger")
    .addFields(
      { name: "ยอดโดเนทรวม", value: `**${fmtMoney(summary.donated)}**`, inline: true },
      { name: "เพิ่มเงินเข้า", value: `**${fmtMoney(summary.manualIn)}**`, inline: true },
      { name: "เบิกเงินออก", value: `**${fmtMoney(summary.withdrawn)}**`, inline: true },
      { name: "ยอดคงเหลือ", value: `**${fmtMoney(summary.balance)}**`, inline: true },
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
        return `${i + 1}. **${sign}${fmtMoney(r.amount)}** • ${r.reason}\n👤 ${who}\n💼 คงเหลือหลังรายการ: **${fmtMoney(r.balance_after)}**\n🕒 ${fmtDateTH(r.created_at)}${note}`;
      }).join("\n\n")
    : "- ยังไม่มีประวัติการเงิน";

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📜 ประวัติการเงิน")
    .setDescription(desc)
    .setFooter({ text: `ยอดคงเหลือปัจจุบัน ${fmtMoney(summary.balance)}` });
}

function buildCashModal(kind) {
  const isOut = kind === "out";
  const isSet = kind === "set_balance";
  return new ModalBuilder()
    .setCustomId(`admin:cash:modal:${kind}`)
    .setTitle(isSet ? "ตั้งยอดปัจจุบัน" : (isOut ? "เบิกเงินออก" : "เพิ่มเงินเข้า"))
    .addComponents(
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
          .setPlaceholder(isSet ? "เช่น ตั้งยอดเริ่มต้น / ปรับให้ตรงเงินจริง" : (isOut ? "เช่น ค่าใช้จ่ายเซิร์ฟเวอร์" : "เช่น เติมเงินเข้าระบบจริง"))
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("note")
          .setLabel("หมายเหตุ")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder("ถ้ามี")
      ),
      ...(isOut
        ? [
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("image_url")
                .setLabel("ลิงก์รูปหลักฐาน (ไม่บังคับ)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder("https://...")
            ),
          ]
        : []),
    );
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

  if (id === "admin:cash:add") {
    return interaction.showModal(buildCashModal("in"));
  }

  if (id === "admin:cash:withdraw") {
    return interaction.showModal(buildCashModal("out"));
  }

  if (id === "admin:cash:set_balance") {
    return interaction.showModal(buildCashModal("set_balance"));
  }

  if (id === "admin:cash:sync_donate") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const summary = await getCashSummary(interaction.guildId);
    if (!summary.ledgerReady) {
      return safeReply(interaction, { content: "❌ ยังไม่พบตาราง cash ledger — รัน scripts/create_cash_ledger.sql ก่อน", ephemeral: true });
    }

    const target = summary.donated;
    const diff = target - summary.balance;
    if (diff === 0) {
      return safeReply(interaction, { content: `ℹ️ ยอดปัจจุบันตรงกับยอดโดเนทสำเร็จอยู่แล้ว (**${fmtMoney(target)}**)`, ephemeral: true });
    }

    const row = await CashLedgerRepo.addEntry({
      guildId: interaction.guildId,
      txnType: diff > 0 ? "IN" : "OUT",
      amount: Math.abs(diff),
      reason: "ซิงก์ยอดตามโดเนทสำเร็จ",
      note: `target=${target}; donated=${summary.donated}; before=${summary.balance}`,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag ?? interaction.user.username,
    });

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag ?? interaction.user.username,
      action: "CASH_SYNC_DONATE",
      target: String(row.ledger_id),
      meta: {
        target_balance: target,
        donated: summary.donated,
        before_balance: summary.balance,
        after_balance: row.balance_after,
        diff,
      },
    });

    const result = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔄 ซิงก์ยอดตามโดเนทสำเร็จแล้ว")
      .addFields(
        { name: "ยอดโดเนทสำเร็จ", value: `**${fmtMoney(summary.donated)}**`, inline: true },
        { name: "ยอดก่อนซิงก์", value: `**${fmtMoney(summary.balance)}**`, inline: true },
        { name: "ยอดหลังซิงก์", value: `**${fmtMoney(row.balance_after)}**`, inline: true },
      )
      .setFooter({ text: `บันทึกเมื่อ ${fmtDateTH(row.created_at || new Date())}` });

    return safeReply(interaction, { embeds: [result], ephemeral: true });
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

  if (kind === "set_balance") {
    const target = Math.trunc(amount);
    if (!Number.isFinite(target) || target < 0) {
      throw new Error("ยอดเป้าหมายต้องเป็น 0 หรือมากกว่า");
    }

    const summary = await getCashSummary(interaction.guildId);
    if (!summary.ledgerReady) {
      throw new Error("ยังไม่พบตาราง cash ledger — รัน scripts/create_cash_ledger.sql ก่อน");
    }

    const diff = target - summary.balance;
    if (diff === 0) {
      return safeReply(interaction, { content: `ℹ️ ยอดปัจจุบันเท่ากับ **${fmtMoney(target)}** อยู่แล้ว`, ephemeral: true });
    }

    const row = await CashLedgerRepo.addEntry({
      guildId: interaction.guildId,
      txnType: diff > 0 ? "IN" : "OUT",
      amount: Math.abs(diff),
      reason: reason || "ตั้งยอดปัจจุบัน",
      note: [note, `target=${target}`, `before=${summary.balance}`].filter(Boolean).join(" | "),
      actorId: interaction.user.id,
      actorTag: interaction.user.tag ?? interaction.user.username,
    });

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag ?? interaction.user.username,
      action: "CASH_SET_BALANCE",
      target: String(row.ledger_id),
      meta: {
        target_balance: target,
        before_balance: summary.balance,
        after_balance: row.balance_after,
        diff,
        reason,
        note,
      },
    });

    const result = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("🎯 ตั้งยอดปัจจุบันสำเร็จ")
      .addFields(
        { name: "ยอดก่อนปรับ", value: `**${fmtMoney(summary.balance)}**`, inline: true },
        { name: "ยอดเป้าหมาย", value: `**${fmtMoney(target)}**`, inline: true },
        { name: "ส่วนต่างที่ปรับ", value: `**${diff > 0 ? "+" : "-"}${fmtMoney(Math.abs(diff))}**`, inline: true },
        { name: "เหตุผล", value: String(reason || "-"), inline: false },
        { name: "หมายเหตุ", value: note || "-", inline: false },
      )
      .setFooter({ text: `บันทึกเมื่อ ${fmtDateTH(row.created_at || new Date())}` });

    return safeReply(interaction, { embeds: [result], ephemeral: true });
  }

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

  if (imageUrl) {
    result.setImage(imageUrl);
  }

  return safeReply(interaction, { embeds: [result], ephemeral: true });
}
