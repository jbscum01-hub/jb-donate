// src/discord/panels/staffPanel.js
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function buildStaffPanel(orderNo) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`staff_approve:${orderNo}`)
      .setLabel("APPROVE")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`staff_gen:${orderNo}`)
      .setLabel("GEN")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`staff_set_plate:CAR:${orderNo}`)
      .setLabel("SET CAR PLATE")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`staff_set_plate:BOAT:${orderNo}`)
      .setLabel("SET BOAT PLATE")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`staff_close:${orderNo}`)
      .setLabel("CLOSE")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`staff_cancel:${orderNo}`)
      .setLabel("CANCEL")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}
