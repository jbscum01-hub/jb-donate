import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} from "discord.js";
import { BOOSTS, VIP_PACKS } from "../../domain/catalog.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { isSteamId17, safeSlugUsername } from "../../domain/validators.js";
import { nextOrderNo } from "../../domain/orderNo.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { IDS } from "../../config/constants.js";
import { createTicketChannel } from "../utils/tickets.js";
import { buildStaffPanel } from "../panels/staffPanel.js";
import { safeReply } from "../utils/messages.js";

export async function createOrderFromModal(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    const [_, type, code] = interaction.customId.split(":");
    const ign = interaction.fields.getTextInputValue("ign").trim();
    const steam = interaction.fields.getTextInputValue("steam").trim();
    const note = (interaction.fields.getTextInputValue("note") || "").trim();

    if (!isSteamId17(steam)) {
      return safeReply(interaction, {
        content: "❌ SteamID ต้องเป็นเลข 17 หลักเท่านั้น",
        ephemeral: true,
      });
    }

    const existingOpen = await OrdersRepo.findOpenByUser(interaction.guildId, interaction.user.id);
    if (existingOpen) {
      const ref = existingOpen.ticket_channel_id
        ? `<#${existingOpen.ticket_channel_id}>`
        : `Order ${existingOpen.order_no}`;

      return safeReply(interaction, {
        content: `⚠️ คุณมีออเดอร์ที่ยังเปิดอยู่แล้ว: ${ref}
กรุณาดำเนินรายการเดิมให้เสร็จก่อน`,
        ephemeral: true,
      });
    }

    let amount = 0;
    let packName = code;
    let donatePack = null;

    if (type === "DONATE") {
      donatePack = await DonatePackRepo.getPackDetails(code);
      amount = Number(donatePack?.price ?? 0);
      packName = donatePack?.pack_name ?? code;
    }

    if (type === "BOOST") amount = Number(BOOSTS[code]?.price ?? 0);
    if (type === "VIP") amount = Number(VIP_PACKS[code]?.price ?? 0);

    if (!amount) {
      return safeReply(interaction, {
        content: "❌ ไม่พบแพ็กที่เลือก",
        ephemeral: true,
      });
    }

    const orderNo = await nextOrderNo("JB");
    const slug = safeSlugUsername(interaction.user.username);
    const seq = orderNo.split("-").pop();
    const channelName = `donate-${slug}-${seq}`;
    const ticket = await createTicketChannel(interaction.guild, interaction.user, channelName);
    const userTag = interaction.user.tag ?? interaction.user.username;

    await OrdersRepo.insert({
      order_no: orderNo,
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      user_tag: userTag,
      type,
      pack_id: donatePack?.pack_id ?? null,
      pack_code: code,
      amount,
      ign,
      steam_id: steam,
      note,
      ticket_channel_id: ticket.id,
    });

    const queueCh = await interaction.client.channels.fetch(IDS.QUEUE_CHANNEL_ID);
    const qmsg = await queueCh.send(
      `🧾 New Order **${orderNo}** | <@${interaction.user.id}> | ${type}:${code} | ${amount}฿ | Ticket: <#${ticket.id}>`
    );
    await OrdersRepo.setQueueMessageId(orderNo, qmsg.id);

    const embedColor =
      type === "DONATE" && donatePack?.embed_color != null
        ? Number(donatePack.embed_color)
        : 0x2b2d31;

    const intro = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`🎫 Ticket: ${orderNo}`)
      .setDescription("กรุณาแนบสลิปในห้องนี้ และถ้าแพ็กมีรถ/เรือ ให้เลือกจากเมนูด้านล่าง")
      .addFields(
        {
          name: "ผู้ซื้อ",
          value: `<@${interaction.user.id}> (${userTag})`,
          inline: false,
        },
        {
          name: "แพ็ก",
          value: `${type}:${packName} (${amount}฿)`,
          inline: true,
        },
        {
          name: "IGN",
          value: ign,
          inline: true,
        },
        {
          name: "SteamID",
          value: steam,
          inline: true,
        },
        {
          name: "Note",
          value: note || "-",
          inline: false,
        },
        {
          name: "Status",
          value: "PENDING",
          inline: true,
        },
        {
          name: "📌 สำคัญ",
          value: "ใส่ชื่อให้ตรงกับตัวละครทุกกรณี ถ้าทีมงานตรวจแล้วชื่อไม่ตรง จะให้เปิดเคสใหม่",
          inline: false,
        }
      );

    if (type === "DONATE" && donatePack?.image_url) {
      intro.setImage(donatePack.image_url);
    }

    if (type === "DONATE") {
      const bullets = donatePack?.benefits?.length
        ? donatePack.benefits.map((x) => `• ${x}`).join("\n")
        : (donatePack?.displayItems ?? []).map((x) => `• ${x}`).join("\n");

      if (bullets) {
        intro.addFields({
          name: "สิทธิ์ที่ได้รับ",
          value: bullets.slice(0, 1024),
          inline: false,
        });
      }
    }

    const components = [];

    if (type === "DONATE") {
      const options = [];

      for (const v of donatePack?.vehicleChoices ?? []) {
        options.push({ label: `CAR: ${v}`, value: `CAR:${v}` });
      }

      for (const b of donatePack?.boatChoices ?? []) {
        options.push({ label: `BOAT: ${b}`, value: `BOAT:${b}` });
      }

      if (options.length) {
        const select = new StringSelectMenuBuilder()
          .setCustomId(`ticket_model_select:${orderNo}`)
          .setPlaceholder("เลือก model รถ/เรือ (ถ้ามี)")
          .addOptions(options.slice(0, 25));

        components.push(new ActionRowBuilder().addComponents(select));
      }
    }

    const staffRows = buildStaffPanel(orderNo);

    await ticket.send({
      content: `<@${interaction.user.id}>`,
      embeds: [intro],
      components: [...components, ...staffRows],
    });

    return safeReply(interaction, {
      content: `✅ สร้าง Ticket แล้ว: <#${ticket.id}> (Order: ${orderNo})`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("createOrderFromModal error:", err);
    return safeReply(interaction, {
      content: "❌ สร้างออเดอร์ไม่สำเร็จ (ดู log)",
      ephemeral: true,
    });
  }
}
