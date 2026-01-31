import { MessageFlags } from "discord.js";

export async function safeReply(interaction, payload) {
  const p = { ...payload };

  // Support legacy { ephemeral:true } while using v14 flags API
  if (p.ephemeral === true) {
    delete p.ephemeral;
    p.flags = MessageFlags.Ephemeral;
  }

  // If already acknowledged, never call reply() again
  if (interaction.deferred || interaction.replied) {
    try {
      return await interaction.editReply(p);
    } catch {
      return await interaction.followUp(p);
    }
  }

  return await interaction.reply(p);
}
