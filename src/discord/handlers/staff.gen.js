import { MessageFlags } from "discord.js";
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { IDS } from "../../config/constants.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { BOOSTS, VIP_PACKS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";

async function buildTemplate(order) {
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
    const p = await DonatePackRepo.getPackDetails(order.pack_code);
    lines.push("ITEMS:");
    for (const it of (p?.displayItems ?? [])) lines.push(`- ${it}`);
    lines.push("");

    lines.push("SPAWN COMMANDS:");
    for (const cmd of (p?.spawnItems ?? [])) lines.push(cmd);
    lines.push("");

    if (order.selected_vehicle) {
      const selected = p?.vehicleChoiceMap?.[order.selected_vehicle];
      lines.push("CAR:");
      lines.push(`Model: ${order.selected_vehicle}`);
      lines.push(`Command: ${selected?.spawn_command_template ?? "-"}`);
      lines.push("");
    }
    if (order.selected_boat) {
      const selected = p?.boatChoiceMap?.[order.selected_boat];
      lines.push("BOAT:");
      lines.push(`Model: ${order.selected_boat}`);
      lines.push(`Command: ${selected?.spawn_command_template ?? "-"}`);
      lines.push("");
    }

    if (p?.carInsurance) lines.push(`INSURANCE CAR: ${p.carInsurance.total} time(s) / ${p.carInsurance.days} day(s)`);
    if (p?.boatInsurance) lines.push(`INSURANCE BOAT: ${p.boatInsurance.total} time(s) / ${p.boatInsurance.days} day(s)`);
  }

  if (order.type === "BOOST") {
    const b = BOOSTS[order.pack_code];
    lines.push("BOOST EFFECTS:");
    for (const e of b?.effects ?? []) lines.push(`- ${e}`);
  }

  if (order.type === "VIP") {
    const v = VIP_PACKS[order.pack_code];
    lines.push("VIP WEEKLY ITEMS:");
    for (const it of (v?.displayItems ?? [])) lines.push(`- ${it}`);
    lines.push("");
    lines.push("VIP WEEKLY SPAWN COMMANDS:");
    for (const cmd of (v?.spawnItems ?? [])) lines.push(cmd);
  }

  lines.push("===============================");
  return "```\n" + lines.join("\n") + "\n```";
}

export async function genTemplate(interaction) {
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
    return safeReply(interaction, { content: "❌ ต้อง APPROVE ก่อนจึงจะ GEN ได้", ephemeral: true });
  }

  const logCh = await interaction.client.channels.fetch(IDS.LOG_CHANNEL_ID);
  await logCh.send(await buildTemplate(order));

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

export async function genCommands(interaction) {
  return genTemplate(interaction);
}
