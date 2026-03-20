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
    PLATINUM: "💠",
    DIAMOND: "💎",
  };
  return map[code] ?? "🧾";
}

function money(n) {
  return `${Number(n || 0).toLocaleString("th-TH")} บาท`;
}

function buildPackPreviewField(pack) {
  const title = `${iconForPack(pack.pack_code)} ${pack.pack_code} — ${money(pack.price)}`;
  const lines = (pack.summary_lines?.length ? pack.summary_lines : ["กดเลือกแพ็กเพื่อดูรายละเอียดเต็ม"]).slice(0, 4);
  return {
    name: title.slice(0, 256),
    value: lines.map((x) => `• ${x}`).join("
").slice(0, 1024),
    inline: false,
  };
}

export async function buildShopPanel() {
  const packs = await DonatePackRepo.listActiveShopOptions();

  const introEmbed = new EmbedBuilder()
    .setColor(0x1f8b4c)
    .setTitle("🛒 J&B DONATE SHOP")
    .setDescription(
`J&B : Project SCUM PVE 💀

ขอบคุณทุกการสนับสนุน ❤️
ระบบ Donate ของเรา **ไม่ Pay to Win**
เน้น Cosmetic / ความสะดวก / สนับสนุนเซิร์ฟเป็นหลัก`
    )
    .addFields(
      {
        name: "📩 วิธีซื้อ",
        value:
`1) เลือกแพ็กที่ต้องการ
2) กรอกข้อมูลให้ตรงกับตัวละคร
3) โอนเงินและส่งสลิปในห้อง Ticket
4) รอทีมงานตรวจสอบและดำเนินการ`,
        inline: false,
      },
      {
        name: "📜 เงื่อนไข",
        value:
`• ชื่อตัวละครต้องตรงกับในเกม
• Donate แล้วไม่สามารถขอคืนเงิน
• แอดมินขอสงวนสิทธิ์ปรับแพ็กเพื่อสมดุลเซิร์ฟ`,
        inline: false,
      }
    )
    .setFooter({
      text: packs.length
        ? `J&B SCUM PVE • Active Packs: ${packs.length}`
        : "J&B SCUM PVE",
    });

  const previewEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("📦 รายการแพ็กโดเนท")
    .setDescription("ผู้เล่นสามารถดูภาพรวมทุกแพ็กได้ก่อน และกดเลือกจากเมนูด้านล่างเพื่อดูรายละเอียด/ซื้อแพ็ก");

  if (!packs.length) {
    previewEmbed.addFields({
      name: "ยังไม่มีแพ็กที่เปิดใช้งาน",
      value: "กรุณาติดต่อทีมงาน",
      inline: false,
    });
  } else {
    previewEmbed.addFields(packs.map(buildPackPreviewField).slice(0, 25));
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("shop_select")
    .setPlaceholder("🧾 เลือกแพ็กเพื่อดูรายละเอียด / ซื้อแพ็ก");

  if (!packs.length) {
    select.addOptions({
      label: "ไม่มีแพ็กที่เปิดใช้งาน",
      description: "กรุณาติดต่อแอดมิน",
      value: "DISABLED:NO_PACKS",
    });
  } else {
    select.addOptions(
      packs.slice(0, 25).map((pack) => ({
        label: `${iconForPack(pack.pack_code)} ${pack.pack_code}`.slice(0, 100),
        description: `${money(pack.price)} • ${pack.pack_name}`.slice(0, 100),
        value: `${pack.pack_type}:${pack.pack_code}`,
      }))
    );
  }

  return {
    embeds: [introEmbed, previewEmbed],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}
