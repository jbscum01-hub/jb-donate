// src/discord/panels/vehicleCard.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function buildVehicleCard({ plate, kind, model, ownerUserId, ownerTag, insurance }) {
  const embed = new EmbedBuilder()
    .setTitle(`Vehicle Card`)
    .addFields(
      { name: "ทะเบียน", value: plate, inline: true },
      { name: "Kind", value: kind, inline: true },
      { name: "Model", value: model ?? "-", inline: true },
      { name: "Owner", value: `<@${ownerUserId}> (${ownerTag})`, inline: false },
    );

  if (!insurance) {
    embed.addFields({ name: "Insurance", value: "ไม่มีประกัน", inline: false });
  } else {
    const remain = Math.max(0, (insurance.total ?? 0) - (insurance.used ?? 0));
    const exp = insurance.expire_at ? `<t:${Math.floor(new Date(insurance.expire_at).getTime()/1000)}:f>` : "-";
    embed.addFields(
      { name: "Insurance", value: `เหลือ **${remain}** / ทั้งหมด **${insurance.total}**`, inline: false },
      { name: "Expire", value: exp, inline: true },
    );
  }

  const remain = insurance ? Math.max(0, (insurance.total ?? 0) - (insurance.used ?? 0)) : 0;
  const expired = insurance?.expire_at ? (new Date(insurance.expire_at).getTime() <= Date.now()) : false;
  const btn = new ButtonBuilder()
    .setCustomId(`vehiclecard_useins:${plate}:${kind}`)
    .setLabel(kind === "BOAT" ? "USE BOAT INSURANCE" : "USE CAR INSURANCE")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!insurance || remain <= 0 || expired);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(btn)],
  };
}
