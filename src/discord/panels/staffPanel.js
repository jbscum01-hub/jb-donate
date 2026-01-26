import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function buildStaffPanel(orderNo) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`staff_approve:${orderNo}`).setLabel("APPROVE").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`staff_gen:${orderNo}`).setLabel("GEN").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`staff_set_plate:${orderNo}`).setLabel("SET PLATE").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`staff_close:${orderNo}`).setLabel("CLOSE").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`staff_cancel:${orderNo}`).setLabel("CANCEL").setStyle(ButtonStyle.Danger),
  );
  return [row];
}
