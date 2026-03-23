import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

function money(v) {
  return `${Number(v || 0).toLocaleString("th-TH")} บาท`;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeLines(lines = []) {
  return lines
    .map((x) => cleanText(x))
    .filter(Boolean);
}

function pushSpacer(lines) {
  if (lines.length && lines[lines.length - 1] !== "") {
    lines.push("");
  }
}

function pushBulletSection(lines, title, values = []) {
  const cleaned = normalizeLines(values);
  if (!cleaned.length) return;
  pushSpacer(lines);
  lines.push(title);
  for (const value of cleaned) {
    lines.push(`• ${value}`);
  }
}

function pushInlineChoiceSection(lines, title, values = []) {
  const cleaned = normalizeLines(values);
  if (!cleaned.length) return;
  pushSpacer(lines);
  lines.push(title);
  lines.push(`• ${cleaned.join(" • ")}`);
}

export function buildPackDetailLines(details) {
  const lines = [];

  const description = cleanText(details?.description);
  if (description) {
    lines.push(description);
  }

  pushBulletSection(lines, "🎁 **สิทธิ์**", details?.benefits ?? []);
  pushBulletSection(lines, "📦 **ของที่ได้รับ**", details?.displayItems ?? []);
  pushInlineChoiceSection(lines, "🚗 **รถที่เลือกได้**", details?.vehicleChoices ?? []);
  pushInlineChoiceSection(lines, "🛥️ **เรือที่เลือกได้**", details?.boatChoices ?? []);

  const insuranceLines = [];

  if (Number(details?.car_insurance_total || 0) > 0) {
    insuranceLines.push(
      `รถ ${Number(details.car_insurance_total)} ครั้ง / ${Number(details.car_insurance_days || 0)} วัน`
    );
  }

  if (Number(details?.boat_insurance_total || 0) > 0) {
    insuranceLines.push(
      `เรือ ${Number(details.boat_insurance_total)} ครั้ง / ${Number(details.boat_insurance_days || 0)} วัน`
    );
  }

  pushBulletSection(lines, "🛡️ **ประกัน**", insuranceLines);

  while (lines[0] === "") lines.shift();
  while (lines[lines.length - 1] === "") lines.pop();

  return lines.length ? lines : ["-"];
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
