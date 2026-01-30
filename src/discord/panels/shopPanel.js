import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";

export function buildShopPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x1f8b4c) // เขียวเข้มแนว SCUM
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
      text: "Secure Donate System • J&B SCUM PVE",
    });

  const select = new StringSelectMenuBuilder()
    .setCustomId("shop_select")
    .setPlaceholder("🧾 เลือกแพ็กเกจที่ต้องการสนับสนุนเซิร์ฟเวอร์")
    .addOptions(
      {
        label: "🥉 BRONZE",
        description: "Donate Package • 50",
        value: "DONATE:BRONZE",
      },
      {
        label: "🥈 SILVER",
        description: "Donate Package • 100",
        value: "DONATE:SILVER",
      },
      {
        label: "🥇 GOLD",
        description: "Donate Package • 200",
        value: "DONATE:GOLD",
      },
      {
        label: "💎 PLATINUM",
        description: "Donate Package • 350",
        value: "DONATE:PLATINUM",
      },
      {
        label: "👑 DIAMOND",
        description: "Donate Package • 500",
        value: "DONATE:DIAMOND",
      },
      //{
      //  label: "⭐ Elite Operator",
      //  description: "Boost Package • 399",
      //  value: "BOOST:ELITE_OPERATOR",
      //},
      {
        label: "🟢 VIP BASIC",
        description: "VIP Package • 199",
        value: "VIP:BASIC",
      },
      {
        label: "🔵 VIP PRO",
        description: "VIP Package • 300",
        value: "VIP:PRO",
      },
      {
        label: "🔴 VIP ELITE",
        description: "VIP Package • 500",
        value: "VIP:ELITE",
      }
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}
