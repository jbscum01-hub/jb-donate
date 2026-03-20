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

function divider() {
  return "━━━━━━━━━━━━━━━━━━━";
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function buildPackLines(pack) {
  const lines = [];

  for (const item of pack.items ?? []) {
    const qty = Number(item.quantity || 0);
    const name = item.item_name || item.item_spawn_name || item.item_code || "Unknown Item";

    if (/money/i.test(item.item_code || "") || /scum\$|money|cash/i.test(name)) {
      lines.push(`• SCUM$ ${formatMoney(qty)}`);
      continue;
    }

    lines.push(`• ${name}${qty > 1 ? ` x${qty}` : ""}`);
  }

  const vehicles = pack.vehicleChoices ?? [];
  if (vehicles.length) {
    const vehicleText = vehicles.join(" / ");
    const total = Number(pack.car_insurance?.total || 0);
    lines.push(`• เลือกรถ 1 คัน (${vehicleText})${total > 0 ? ` + ประกัน ${total} ครั้ง ` : ""}`.trim());
  }

  const boats = pack.boatChoices ?? [];
  if (boats.length) {
    const boatText = boats.join(" / ");
    const total = Number(pack.boatInsurance?.total || 0);
    lines.push(`• เลือกเรือ 1 คัน (${boatText})${total > 0 ? ` + ประกัน ${total} ครั้ง ` : ""}`.trim());
  }

  return lines.length ? lines : ["• -"];
}

export async function buildShopPanel() {
  const packs = await DonatePackRepo.listActiveShopOptions();
  const detailed = await Promise.all(packs.map((pack) => DonatePackRepo.getPackDetails(pack.pack_code)));
  const activePacks = detailed.filter(Boolean);

  const sectionLines = [];
  for (const pack of activePacks) {
    sectionLines.push(
      divider(),
      `${iconForPack(pack.pack_code)} ${String(pack.pack_code || pack.pack_name || "PACK").toUpperCase()} – ${Number(pack.price || 0)} บาท`,
      divider(),
      ...buildPackLines(pack),
      ""
    );
  }

  const description = [
    "J&B : Project SCUM PVE 💀",
    "",
    "ขอบคุณทุกการสนับสนุน ❤️",
    'ระบบ Donate ของเรา “ไม่ Pay to Win”',
    "เน้น Cosmetic / ความสะดวก / สนับสนุนเซิร์ฟเป็นหลัก",
    "",
    ...sectionLines,
    divider(),
    "📩 วิธีซื้อ",
    divider(),
    "1) เลือกแพ็กที่ต้องการ",
    "2) กรอกข้อมูล (ใส่ชื่อให้ตรงกับตัวละครทุกกรณี หากชื่อไม่ตรงจะให้เปิดเคสใหม่)",
    "3) โอนเงิน",
    "4) ส่งหลักฐานในห้อง",
    "5) รอรับของในเกม",
    "",
    "━━━━━━━━━━━━━━",
    "📌 ช่องทางโดเนท",
    "• TrueMoney Wallet: 08x-xxx-xxxx",
    "• PromptPay: xxx-xxx-xxxx",
    "• ธนาคาร: xxx",
    "━━━━━━━━━━━━━━",
    "",
    "━━━━━━━━━━━━━━",
    "🧾 แจ้งหลักฐานการโดเนท",
    "",
    "กรุณาส่ง:",
    "• รูปสลิป",
    "",
    "ทีมงานจะตรวจสอบภายใน 24 ชม. ⏳",
    "━━━━━━━━━━━━━━",
    "",
    divider(),
    "📜 เงื่อนไข",
    divider(),
    "• Donate แล้วไม่สามารถขอคืนเงิน",
    "• แอดมินขอสงวนสิทธิ์ปรับแพ็กเพื่อสมดุลเซิร์ฟ",
    "",
    "ขอบคุณที่ช่วยกันทำให้ J&B โตไปด้วยกัน ❤️",
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x1f8b4c)
    .setTitle("🛒 J&B DONATE SHOP")
    .setDescription(description.slice(0, 4096))
    .setFooter({
      text: activePacks.length
        ? `J&B SCUM PVE • Active Packs: ${activePacks.length}`
        : "J&B SCUM PVE",
    });

  const select = new StringSelectMenuBuilder()
    .setCustomId("shop_select")
    .setPlaceholder("🧾 เลือกแพ็กที่ต้องการ");

  if (!activePacks.length) {
    select.addOptions({
      label: "ไม่มีแพ็กที่เปิดใช้งาน",
      description: "กรุณาติดต่อแอดมิน",
      value: "DISABLED:NO_PACKS",
    });
  } else {
    select.addOptions(
      activePacks.slice(0, 25).map((pack) => ({
        label: `${iconForPack(pack.pack_code)} ${String(pack.pack_code || pack.pack_name).toUpperCase()} - ${Number(pack.price || 0)} บาท`.slice(0, 100),
        description: `${pack.pack_name}`.slice(0, 100),
        value: `${pack.pack_type}:${pack.pack_code}`,
      }))
    );
  }

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}
