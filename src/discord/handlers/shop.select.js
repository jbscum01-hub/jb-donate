// src/discord/handlers/shop_select.js
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

export async function openOrderModal(interaction) {
  try {
    const raw = interaction.values?.[0];
    if (!raw) {
      // กันเคส interaction แปลก ๆ
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ ไม่พบแพ็กที่เลือก ลองใหม่อีกครั้งนะคะ", ephemeral: true });
      }
      return;
    }

    const [type, code] = raw.split(":");
    if (!type || !code) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ รูปแบบแพ็กไม่ถูกต้อง ลองใหม่อีกครั้งนะคะ", ephemeral: true });
      }
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`order_create:${type}:${code}`)
      .setTitle(`Order - ${type}:${code}`);

    const ign = new TextInputBuilder()
      .setCustomId("ign")
      .setLabel("IGN (ชื่อตัวละคร)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const steam = new TextInputBuilder()
      .setCustomId("steam")
      .setLabel("SteamID (17 หลัก)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const note = new TextInputBuilder()
      .setCustomId("note")
      .setLabel("หมายเหตุ (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(ign),
      new ActionRowBuilder().addComponents(steam),
      new ActionRowBuilder().addComponents(note),
    );

    // สำคัญ: showModal ต้องทำให้เร็วที่สุด และต้อง catch error ไม่ให้โปรเซสล้ม
    await interaction.showModal(modal);
  } catch (err) {
    // กัน Unknown interaction (10062) / ตอบไม่ทัน 3 วิ / ตอบซ้ำ
    console.error("openOrderModal error:", err);

    const msg = "❌ ระบบตอบช้าไปนิดนึง ลองเลือกแพ็กอีกครั้งนะคะ";

    try {
      // ถ้ายังตอบได้ ให้ส่ง ephemeral แจ้งผู้ใช้
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {
      // ถ้าตอบไม่ได้แล้วก็ปล่อย (interaction หมดอายุจริง)
    }
  }
}
