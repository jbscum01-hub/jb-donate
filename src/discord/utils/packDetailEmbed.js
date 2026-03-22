import { EmbedBuilder } from "discord.js";

function money(v) {
  return `${Number(v || 0).toLocaleString("th-TH")} บาท`;
}

export function buildPackDetailLines(details) {
  const lines = [];

  if (details.description) {
    lines.push(String(details.description).trim());
  }

  if (details.benefits?.length) {
    lines.push("", ...details.benefits.map((x) => `🎁 ${x}`));
  }

  if (details.displayItems?.length) {
    lines.push("", ...details.displayItems.map((x) => `📦 ${x}`));
  }

  if (details.vehicleChoices?.length) {
    lines.push("", ...details.vehicleChoices.map((x) => `🚗 ${x}`));
  }

  if (details.boatChoices?.length) {
    lines.push("", ...details.boatChoices.map((x) => `🛥️ ${x}`));
  }

  if (Number(details.car_insurance_total || 0) > 0) {
    lines.push(
      "",
      `🛡️ ประกันรถ ${details.car_insurance_total} ครั้ง / ${details.car_insurance_days || 0} วัน`
    );
  }

  if (Number(details.boat_insurance_total || 0) > 0) {
    lines.push(`🛡️ ประกันเรือ ${details.boat_insurance_total} ครั้ง / ${details.boat_insurance_days || 0} วัน`);
  }

  return lines.filter((line, index, arr) => {
    if (line !== "") return true;
    const prev = arr[index - 1];
    const next = arr[index + 1];
    return Boolean(prev) && Boolean(next);
  });
}

export function buildPackDetailsEmbed(details) {
  const lines = buildPackDetailLines(details);

  const embed = new EmbedBuilder()
    .setColor(details.embed_color ?? 0x5865f2)
    .setTitle(`📦 ${details.pack_name} — ${money(details.price)}`)
    .setDescription(lines.join("\n").slice(0, 4096) || "-")
    .addFields(
      { name: "Code", value: `\`${details.pack_code}\``, inline: true },
      { name: "Type", value: details.pack_type || "DONATE", inline: true },
      { name: "Price", value: money(details.price), inline: true },
    );

  if (details.image_url) {
    embed.setImage(details.image_url);
  }

  return embed;
}

export function buildPackDetailFields(details, fieldName = "รายละเอียดแพ็ก") {
  const text = buildPackDetailLines(details).join("\n").trim();
  if (!text) return [];

  const fields = [];
  const chunks = [];
  let current = "";

  for (const line of text.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > 1024) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);

  chunks.forEach((chunk, index) => {
    fields.push({
      name: index === 0 ? fieldName : `${fieldName} (ต่อ)`,
      value: chunk,
      inline: false,
    });
  });

  return fields;
}
