import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";

function iconForPack(code) {
  const map = {
    BRONZE: "🥉",
    SILVER: "🥈",
    GOLD: "🥇",
    PLATINUM: "💎",
    DIAMOND: "👑",
  };
  return map[code] ?? "🧾";
}

export async function buildShopPanel() {
  const packs = await DonatePackRepo.listActiveShopOptions();

  const embed = new EmbedBuilder()
    .setColor(0x1f8b4c)
    .setTitle("🛒 J&B DONATE SHOP")
    .setDescription(
`🎮 **ระบบ Donate อัตโนมัติ – J&B : Project SCUM PVE**

━━━━━━━━━━━━━━━━━━
📌 **ขั้นตอนการใช้งาน**
1️⃣ เลือกแพ็กเกจที่ต้องการ
2️⃣ กรอก **IGN / SteamID** ให้ครบถ้วน
3️⃣ บอทจะสร้าง **Ticket ส่วนตัว** สำหรับแนบสลิป

⚠️ Ticket จะเห็นเฉพาะคุณและทีมงานเท่านั้น
━━━━━━━━━━━━━━━━━━`
    )
    .setFooter({
      text: packs.length
        ? `Secure Donate System • J&B SCUM PVE • Active Packs: ${packs.length}`
        : "Secure Donate System • J&B SCUM PVE",
    });

  const select = new StringSelectMenuBuilder()
    .setCustomId("shop_select")
    .setPlaceholder("🧾 เลือกแพ็กเกจที่ต้องการสนับสนุนเซิร์ฟเวอร์");

  if (!packs.length) {
    select.addOptions({
      label: "ไม่มีแพ็กที่เปิดใช้งาน",
      description: "กรุณาติดต่อแอดมิน",
      value: "DISABLED:NO_PACKS",
    });
  } else {
    select.addOptions(
      packs.slice(0, 25).map((pack) => ({
        label: `${iconForPack(pack.pack_code)} ${pack.pack_name}`.slice(0, 100),
        description: `${pack.pack_type} Package • ${Number(pack.price || 0)}`.slice(0, 100),
        value: `${pack.pack_type}:${pack.pack_code}`,
      }))
    );
  }

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}
