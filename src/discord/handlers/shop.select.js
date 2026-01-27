// src/discord/handlers/shop.select.js
import { loadConfig } from "../utils/index.js";      // ✅ ปรับให้ตรงไฟล์จริงของคุณ
import { buildDonateModal } from "./modals/index.js"; // ✅ ปรับให้ตรงไฟล์จริงของคุณ

export async function openOrderModal(interaction) {
  try {
    // ✅ ต้องเป็น select menu ตัวนี้เท่านั้น
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "shop_select") return;


    // ✅ ห้าม defer/reply ก่อน showModal
    const cfg = loadConfig();
    const packageKey = interaction.values?.[0];
    const pkg = cfg?.packages?.find((p) => p.key === packageKey);

    if (!pkg) {
      return interaction.reply({
        content: "แพ็กนี้ไม่มีในระบบ หรือ config ยังไม่ถูกต้อง",
        ephemeral: true,
      });
    }

    const modal = buildDonateModal(packageKey);
    return interaction.showModal(modal);
  } catch (err) {
    console.error("openOrderModal error:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          content: "❌ เปิดฟอร์มไม่สำเร็จ (interaction หมดอายุ/ถูกใช้ไปแล้ว) ลองใหม่อีกครั้ง",
          ephemeral: true,
        })
        .catch(() => {});
    }
  }
}
