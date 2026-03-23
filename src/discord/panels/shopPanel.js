import { EmbedBuilder } from "discord.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { IDS } from "../../config/constants.js";
import { buildShopPackMessage } from "../utils/packDetailEmbed.js";

const INTRO_PANEL_KEY = "__INTRO__";

function buildIntroEmbed(activePackCount = 0) {
  const embed = new EmbedBuilder()
    .setColor(0x1f8b4c)
    .setTitle("🛒 J&B DONATE SHOP")
    .setDescription(
`J&B : Project SCUM PVE 💀

ขอบคุณทุกการสนับสนุน ❤️
ระบบ Donate ของเรา **ไม่ Pay to Win**
เน้น Cosmetic / ความสะดวก / สิทธิ์เสริมบางส่วน`
    )
    .addFields(
      {
        name: "📩 วิธีซื้อ",
        value:
`1) เลือกแพ็กที่ต้องการ
2) กดปุ่มซื้อแพ็ก
3) แนบสลิปใน Ticket ให้ครบถ้วน
4) รอทีมงานตรวจสอบและดำเนินการ`,
        inline: false,
      },
      {
        name: "📜 เงื่อนไข",
        value:
`• ชื่อ/ข้อมูลต้องตรงกับในเกม
• Donate แล้วไม่สามารถขอคืนเงินได้
• แอดมินขอสงวนสิทธิ์ปรับแพ็กเพื่อความสมดุลเซิร์ฟ`,
        inline: false,
      }
    )
    .setFooter({ text: `J&B SCUM PVE • Active Packs: ${activePackCount}` });

  if (IDS.SHOP_QR_IMAGE_URL) {
    embed.setImage(IDS.SHOP_QR_IMAGE_URL);
  }

  return embed;
}

export async function buildShopPanels() {
  const packs = await DonatePackRepo.listActiveShopOptions();
  const details = await Promise.all(
    packs.map((pack) => DonatePackRepo.getPackDetails(pack.pack_code))
  );

  const intro = {
    panelKey: INTRO_PANEL_KEY,
    sortOrder: 0,
    packId: null,
    packCode: null,
    payload: {
      embeds: [buildIntroEmbed(packs.length)],
      components: [],
    },
  };

  const packPanels = details
    .filter(Boolean)
    .map((detail, idx) => ({
      panelKey: `PACK:${detail.pack_code}`,
      sortOrder: Number(detail.sort_order || (idx + 1) * 10),
      packId: detail.pack_id,
      packCode: detail.pack_code,
      payload: buildShopPackMessage(detail),
    }));

  return [intro, ...packPanels];
}

export async function buildShopPanel() {
  const panels = await buildShopPanels();
  return panels[0]?.payload ?? { embeds: [buildIntroEmbed(0)], components: [] };
}
