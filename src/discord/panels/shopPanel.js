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

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("th-TH")} บาท`;
}

function formatCountLabel(total, unit) {
  const n = Number(total || 0);
  if (!n) return null;
  return `${unit} ${n} ${n > 1 ? "ครั้ง" : "ครั้ง"}`;
}

function buildPackPreview(pack) {
  const lines = [];

  const displayItems = pack.displayItems ?? [];
  if (displayItems.length) {
    lines.push(`• ${displayItems.slice(0, 2).join("\n• ")}`);
    if (displayItems.length > 2) {
      lines.push(`• และของในแพ็กอีก ${displayItems.length - 2} รายการ`);
    }
  }

  if ((pack.vehicleChoices ?? []).length) {
    lines.push(`• เลือกรถได้ ${pack.vehicleChoices.length} แบบ`);
  }

  if ((pack.boatChoices ?? []).length) {
    lines.push(`• เลือกเรือได้ ${pack.boatChoices.length} แบบ`);
  }

  const carInsurance = formatCountLabel(pack.carInsurance?.total, "ประกันรถ");
  const boatInsurance = formatCountLabel(pack.boatInsurance?.total, "ประกันเรือ");
  if (carInsurance) lines.push(`• ${carInsurance}`);
  if (boatInsurance) lines.push(`• ${boatInsurance}`);

  if (!lines.length && (pack.benefits ?? []).length) {
    return pack.benefits.slice(0, 3).map((x) => `• ${x}`).join("\n");
  }

  return lines.slice(0, 5).join("\n") || "• ดูรายละเอียดเต็มหลังเลือกแพ็ก";
}

function buildSelectDescription(pack) {
  const bits = [formatPrice(pack.price)];
  if ((pack.vehicleChoices ?? []).length) bits.push(`รถ ${pack.vehicleChoices.length} แบบ`);
  if ((pack.boatChoices ?? []).length) bits.push(`เรือ ${pack.boatChoices.length} แบบ`);
  return bits.join(" • ").slice(0, 100);
}

export async function buildShopPanel() {
  const packs = await DonatePackRepo.listActiveShopOptions();
  const detailedPacks = await Promise.all(
    packs.map(async (pack) => (await DonatePackRepo.getPackDetails(pack.pack_code)) ?? pack)
  );

  const introEmbed = new EmbedBuilder()
    .setColor(0x1f8b4c)
    .setTitle("🛒 J&B DONATE SHOP")
    .setDescription(
`J&B : Project SCUM PVE 💀

ขอบคุณทุกการสนับสนุน ❤️
ระบบ Donate ของเรา **ไม่ Pay to Win**
เน้น Cosmetic / ความสะดวก / สนับสนุนเซิร์ฟเป็นหลัก

━━━━━━━━━━━━━━━━━━━
📩 **วิธีซื้อ**
1) เลือกแพ็กที่ต้องการ
2) กรอกข้อมูลให้ตรงกับตัวละคร
3) โอนเงินและส่งสลิปใน Ticket
4) รอทีมงานตรวจสอบ

📜 **เงื่อนไข**
• ชื่อตัวละครต้องตรงกับที่ใช้งานจริง
• Donate แล้วไม่สามารถขอคืนเงิน
• แอดมินขอสงวนสิทธิ์ปรับแพ็กเพื่อสมดุลเซิร์ฟ`
    )
    .setFooter({
      text: detailedPacks.length
        ? `J&B SCUM PVE • Active Packs: ${detailedPacks.length}`
        : "J&B SCUM PVE",
    });

  const packEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("📦 รายการแพ็กโดเนท")
    .setDescription(
      detailedPacks.length
        ? "ผู้เล่นสามารถดูภาพรวมของทุกแพ็กได้ด้านล่าง และกดเลือกแพ็กเพื่อดูรายละเอียดเต็มก่อนซื้อ"
        : "ยังไม่มีแพ็กที่เปิดใช้งานในตอนนี้"
    );

  for (const pack of detailedPacks.slice(0, 10)) {
    packEmbed.addFields({
      name: `${iconForPack(pack.pack_code)} ${pack.pack_code} — ${formatPrice(pack.price)}`,
      value: buildPackPreview(pack).slice(0, 1024),
      inline: false,
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("shop_select")
    .setPlaceholder("🧾 เลือกแพ็กเพื่อดูรายละเอียด / สร้างออเดอร์");

  if (!detailedPacks.length) {
    select.addOptions({
      label: "ไม่มีแพ็กที่เปิดใช้งาน",
      description: "กรุณาติดต่อแอดมิน",
      value: "DISABLED:NO_PACKS",
    });
  } else {
    select.addOptions(
      detailedPacks.slice(0, 25).map((pack) => ({
        label: `${iconForPack(pack.pack_code)} ${pack.pack_code} — ${formatPrice(pack.price)}`.slice(0, 100),
        description: buildSelectDescription(pack),
        value: `${pack.pack_type}:${pack.pack_code}`,
      }))
    );
  }

  return {
    embeds: [introEmbed, packEmbed],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}
