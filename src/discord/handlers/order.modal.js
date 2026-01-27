// src/discord/handlers/order.modal.js
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { DONATE_PACKS, BOOSTS, VIP_PACKS } from "../../domain/catalog.js";
import { isSteamId17, safeSlugUsername } from "../../domain/validators.js";
import { nextOrderNo } from "../../domain/orderNo.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { IDS } from "../../config/constants.js";
import { createTicketChannel } from "../utils/tickets.js";
import { buildStaffPanel } from "../panels/staffPanel.js";

export async function createOrderFromModal(interaction) {
  // customId format: order_create:DONATE:PLATINUM
  const parts = String(interaction.customId || "").split(":");
  const type = parts[1];
  const code = parts[2];

  if (!type || !code) {
    return interaction.reply({
      content: `❌ customId ผิดรูปแบบ: ${interaction.customId}`,
      ephemeral: true,
    });
  }

  const ign = interaction.fields.getTextInputValue("ign").trim();
  const steam = interaction.fields.getTextInputValue("steam").trim();
  const note = (interaction.fields.getTextInputValue("note") || "").trim();

  if (!isSteamId17(steam)) {
    return interaction.reply({
      content: "❌ SteamID ต้องเป็นเลข 17 หลักเท่านั้น",
      ephemeral: true,
    });
  }

  // Defer early to avoid interaction timeout (Render free can be slow)
  await interaction.deferReply({ ephemeral: true });

  // Resolve pack (must exist)
  let pack = null;
  if (type === "DONATE") pack = DONATE_PACKS?.[code] ?? null;
  else if (type === "BOOST") pack = BOOSTS?.[code] ?? null;
  else if (type === "VIP") pack = VIP_PACKS?.[code] ?? null;

  if (!pack) {
    return interaction.editReply({
      content: `❌ ไม่พบแพ็ก (${type}:${code})`,
    });
  }

  const amount = Number(pack.price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return interaction.editReply({
      content: `❌ แพ็กนี้ยังไม่ได้ตั้งราคา (${type}:${code})`,
    });
  }

  const orderNo = await nextOrderNo("JB");

  const slug = safeSlugUsername(interaction.user.username);
  // name format B: donate-<username>-0001
  const seq = orderNo.split("-").pop();
  const channelName = `donate-${slug}-${seq}`;

  const ticket = await createTicketChannel(interaction.guild, interaction.user, channelName);

  await OrdersRepo.insert({
    order_no: orderNo,
    guild_id: interaction.guildId,
    user_id: interaction.user.id,
    user_tag: interaction.user.tag,
    type,
    pack_code: code,
    amount,
    ign,
    steam_id: steam,
    note,
    ticket_channel_id: ticket.id,
  });

  // Queue message
  const queueCh = await interaction.client.channels.fetch(IDS.QUEUE_CHANNEL_ID);
  const qmsg = await queueCh.send(
    `🧾 New Order **${orderNo}** | <@${interaction.user.id}> | ${type}:${code} | ${amount}฿ | Ticket: <#${ticket.id}>`
  );
  await OrdersRepo.setQueueMessageId(orderNo, qmsg.id);

  // Ticket intro
  const intro = new EmbedBuilder()
    .setTitle(`🎫 Ticket: ${orderNo}`)
    .setDescription("กรุณาแนบสลิปในห้องนี้ และเลือก model (ถ้ามี) จากเมนูด้านล่าง")
    .addFields(
      { name: "ผู้ซื้อ", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
      { name: "แพ็ก", value: `${type}:${code} (${amount}฿)`, inline: true },
      { name: "IGN", value: ign, inline: true },
      { name: "SteamID", value: steam, inline: true },
      { name: "Note", value: note ? note : "-", inline: false },
      { name: "Status", value: "PENDING", inline: true }
    );

  const components = [];

  // model select (split CAR / BOAT)
  if (type === "DONATE") {
    const p = DONATE_PACKS[code];

    // 1) CAR select
    if ((p.vehicleChoices ?? []).length) {
      const carOptions = (p.vehicleChoices ?? []).map(v => ({
        label: v,
        value: `CAR:${v}`,
        description: "เลือกรถ 1 คัน"
      }));

      const carSelect = new StringSelectMenuBuilder()
        .setCustomId(`ticket_model_select:${orderNo}`) // ใช้ handler เดิมได้
        .setPlaceholder("🚗 เลือกรถ 1 คัน")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(carOptions);

      components.push(new ActionRowBuilder().addComponents(carSelect));
    }

    // 2) BOAT select
    if ((p.boatChoices ?? []).length) {
      const boatOptions = (p.boatChoices ?? []).map(b => ({
        label: b,
        value: `BOAT:${b}`,
        description: "เลือกเรือ 1 ลำ"
      }));

      const boatSelect = new StringSelectMenuBuilder()
        .setCustomId(`ticket_model_select:${orderNo}`) // ใช้ handler เดิมได้
        .setPlaceholder("🚤 เลือกเรือ 1 ลำ")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(boatOptions);

      components.push(new ActionRowBuilder().addComponents(boatSelect));
    }
  }


  const staffRows = buildStaffPanel(orderNo);

  await ticket.send({
    content: `<@${interaction.user.id}>`,
    embeds: [intro],
    components: [...components, ...staffRows],
  });

  await interaction.editReply({
    content: `✅ สร้าง Ticket แล้ว: <#${ticket.id}> (Order: ${orderNo})`,
  });
}
