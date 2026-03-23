import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

function money(v) {
  return `${Number(v || 0).toLocaleString("th-TH")} บาท`;
}

function cleanLines(lines = []) {
  return lines
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

function pushSection(lines, sectionLines = []) {
  const cleaned = cleanLines(sectionLines);
  if (!cleaned.length) return;
  if (lines.length) lines.push("");
  lines.push(...cleaned);
}

export function buildPackDetailLines(details) {
  const lines = [];

  if (details?.description) {
    lines.push(String(details.description).trim());
  }

  pushSection(lines, (details?.benefits ?? []).map((x) => `🎁 ${x}`));
  pushSection(lines, (details?.displayItems ?? []).map((x) => `📦 ${x}`));
  pushSection(lines, (details?.vehicleChoices ?? []).map((x) => `🚗 ${x}`));
  pushSection(lines, (details?.boatChoices ?? []).map((x) => `🛥️ ${x}`));

  if (Number(details?.car_insurance_total || 0) > 0) {
    pushSection(lines, [
      `🛡️ ประกันรถ ${Number(details.car_insurance_total)} ครั้ง / ${Number(details.car_insurance_days || 0)} วัน`,
    ]);
  }

  if (Number(details?.boat_insurance_total || 0) > 0) {
    pushSection(lines, [
      `🛡️ ประกันเรือ ${Number(details.boat_insurance_total)} ครั้ง / ${Number(details.boat_insurance_days || 0)} วัน`,
    ]);
  }

  return cleanLines(lines.length ? lines : ["-"]);
}

export function buildPackDetailsEmbed(details, { titlePrefix = "📦", includePriceInTitle = true } = {}) {
  const title = includePriceInTitle
    ? `${titlePrefix} ${details.pack_name} — ${money(details.price)}`
    : `${titlePrefix} ${details.pack_name}`;

  const embed = new EmbedBuilder()
    .setColor(details.embed_color ?? 0x5865f2)
    .setTitle(title.slice(0, 256))
    .setDescription(buildPackDetailLines(details).join("\n").slice(0, 4096));

  if (details.image_url) {
    embed.setImage(details.image_url);
  }

  return embed;
}

export function buildShopPackMessage(details) {
  const buyBtn = new ButtonBuilder()
    .setCustomId(`shop:buy:${details.pack_type}:${details.pack_code}`)
    .setLabel("ซื้อแพ็กนี้")
    .setEmoji("🛒")
    .setStyle(ButtonStyle.Success);

  return {
    embeds: [buildPackDetailsEmbed(details)],
    components: [new ActionRowBuilder().addComponents(buyBtn)],
  };
}
