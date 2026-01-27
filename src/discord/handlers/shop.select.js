// src/discord/handlers/shop_select.js
const { loadConfig } = require("../utils");          // ปรับ path ให้ตรงของคุณ
const { buildDonateModal } = require("./modals");    // ปรับ path ให้ตรงของคุณ

async function openOrderModal(interaction) {
  try {
    // ✅ ต้องเป็น select menu ตัวนี้เท่านั้น
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "donate_select_package") return;

    // ✅ ห้าม defer/reply ก่อน showModal
    const cfg = loadConfig();
    const packageKey = interaction.values?.[0];
    const pkg = cfg?.packages?.find(p => p.key === packageKey);

    if (!pkg) {
      // ตอบได้ (แทน modal) เพราะไม่ต้องเปิด modal แล้ว
      return interaction.reply({
        content: "แพ็กนี้ไม่มีในระบบ หรือ config ยังไม่ถูกต้อง",
        ephemeral: true,
      });
    }

    const modal = buildDonateModal(packageKey);
    return interaction.showModal(modal);

  } catch (err) {
    console.error("openOrderModal error:", err);

    // ถ้า error หลังจาก interaction หมดอายุ ก็ reply ไม่ได้แล้ว
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ เปิดฟอร์มไม่สำเร็จ (interaction หมดอายุ/ถูกใช้ไปแล้ว) ลองใหม่อีกครั้ง",
        ephemeral: true,
      }).catch(() => {});
    }
  }
}

module.exports = { openOrderModal };
