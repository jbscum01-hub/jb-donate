import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { IDS } from "../../config/constants.js";
import { DONATE_PACKS, BOOSTS, VIP_PACKS, VEHICLE_COMMANDS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";

function buildTemplate(order) {
  const lines = [];
  lines.push("====== SCUM ORDER TEMPLATE ======");
  lines.push(`Order: ${order.order_no}`);
  lines.push(`User: ${order.user_tag} (${order.user_id})`);
  lines.push(`IGN: ${order.ign}`);
  lines.push(`SteamID: ${order.steam_id}`);
  lines.push("");
  lines.push(`TYPE: ${order.type}`);
  lines.push(`PACK: ${order.pack_code} (${order.amount}฿)`);
  lines.push("");

  if (order.type === "DONATE") {
    const p = DONATE_PACKS[order.pack_code];
    lines.push("ITEMS:");
    for (const it of p.items) lines.push(`- ${it}`);
    lines.push("");

    if (order.selected_vehicle) {
      lines.push("CAR:");
      lines.push(`Model: ${order.selected_vehicle}`);
      lines.push(`Command: ${VEHICLE_COMMANDS[order.selected_vehicle] ?? "-"}`);
      lines.push("");
    }
    if (order.selected_boat) {
      lines.push("BOAT:");
      lines.push(`Model: ${order.selected_boat}`);
      lines.push(`Command: ${VEHICLE_COMMANDS[order.selected_boat] ?? "-"}`);
      lines.push("");
    }

    if (p.carInsurance) lines.push(`INSURANCE CAR: ${p.carInsurance.total} time(s) / ${p.carInsurance.days} day(s)`);
    if (p.boatInsurance) lines.push(`INSURANCE BOAT: ${p.boatInsurance.total} time(s) / ${p.boatInsurance.days} day(s)`);
  }

  if (order.type === "BOOST") {
    const b = BOOSTS[order.pack_code];
    lines.push("BOOST EFFECTS:");
    for (const e of b.effects) lines.push(`- ${e}`);
  }

  if (order.type === "VIP") {
    const v = VIP_PACKS[order.pack_code];
    lines.push("VIP WEEKLY ITEMS (summary):");
    for (const it of v.weeklyItems) lines.push(`- ${it}`);
  }

  lines.push("===============================");
  return "```\n" + lines.join("\n") + "\n```";
}

export async function genTemplate(interaction) {
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }
  const orderNo = interaction.customId.split(":")[1];
  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  if (order.status !== "APPROVED") {
    return safeReply(interaction, { content: "❌ ต้อง APPROVE ก่อนจึงจะ GEN ได้", ephemeral: true });
  }

  const logCh = await interaction.client.channels.fetch(IDS.LOG_CHANNEL_ID);
  await logCh.send(buildTemplate(order));

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "ORDER_GEN",
    target: orderNo,
    meta: { selected_vehicle: order.selected_vehicle, selected_boat: order.selected_boat },
  });

  return safeReply(interaction, { content: `✅ GEN sent to log for ${orderNo}`, ephemeral: true });
}

// Backward-compat export (router imports genCommands)
export async function genCommands(interaction) {
  return genTemplate(interaction);
}
