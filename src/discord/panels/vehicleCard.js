import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { formatDateTime } from "../../domain/time.js";

export function buildVehicleCard({ plate, kind, model, ownerUserId, ownerTag, insurance }) {
  const remain = insurance ? Math.max(insurance.total - insurance.used, 0) : 0;

  const embed = new EmbedBuilder()
    .setTitle(kind === "BOAT" ? "🚤 Vehicle Card" : "🚗 Vehicle Card")
    .setDescription(`ทะเบียน: **${plate}**`)
    .addFields(
      { name: "Owner", value: `<@${ownerUserId}> (${ownerTag})`, inline: false },
      { name: "Model", value: model, inline: true },
      { name: "Kind", value: kind, inline: true },
      { name: "Insurance", value: insurance
          ? `เหลือ **${remain}** / รวม ${insurance.total}\nหมดอายุ: **${formatDateTime(insurance.expire_at)}**`
          : "ไม่มีประกัน", inline: false
      },
    );

  const btn = new ButtonBuilder()
    .setCustomId(`vehiclecard_useins:${plate}:${kind}`)
    .setLabel(kind === "BOAT" ? "USE BOAT INSURANCE" : "USE CAR INSURANCE")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!insurance || remain <= 0);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] };
}
