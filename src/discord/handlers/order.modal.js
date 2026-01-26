import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { DONATE_PACKS, BOOSTS, VIP_PACKS } from "../../domain/catalog.js";
import { isSteamId17, safeSlugUsername } from "../../domain/validators.js";
import { nextOrderNo } from "../../domain/orderNo.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { IDS } from "../../config/constants.js";
import { createTicketChannel } from "../utils/tickets.js";
import { buildStaffPanel } from "../panels/staffPanel.js";

/**
 * Modal submit handler
 * customId: order_create:<TYPE>:<CODE>
 */
export async function createOrderFromModal(interaction) {
  // ✅ กัน modal submit timeout 100%
  await interaction.deferReply({ ephemeral: true });

  let ticket = null;
  let orderNo = null;

  try {
    const parts = interaction.customId.split(":");
    const type = parts?.[1];
    const code = parts?.[2];

    const ign = (interaction.fields.getTextInputValue("ign") || "").trim();
    const steam = (interaction.fields.getTextInputValue("steam") || "").trim();
    const note = (interaction.fields.getTextInputValue("note") || "").trim();

    if (!ign) return interaction.editReply({ content: "❌ กรุณากรอก IGN" });
    if (!isSteamId17(steam)) {
      return interaction.editReply({ content: "❌ SteamID ต้องเป็นเลข 17 หลักเท่านั้น" });
    }

    // หา amount จาก catalog
    let amount = 0;
    if (type === "DONATE") amount = DONATE_PACKS?.[code]?.price ?? 0;
    if (type === "BOOST") amount = BOOSTS?.[code]?.price ?? 0;
    if (type === "VIP") amount = VIP_PACKS?.[code]?.price ?? 0;

    if (!type || !code || !amount) {
      return interaction.editReply({ content: "❌ ไม่พบแพ็กที่เลือก (panel อาจเก่า) กรุณาเลือกใหม่อีกครั้ง" });
    }

    // สร้างเลขออเดอร์
    orderNo = await nextOrderNo("JB");

    // ตั้งชื่อห้องแบบ B: donate-<username>-0001
    const slug = safeSlugUsername(interaction.user.username);
    const seq = orderNo.split("-").pop();
    const channelName = `donate-${slug}-${seq}`;

    // ✅ สร้าง ticket channel
    ticket = await createTicketChannel(interaction.guild, interaction.user, channelName);

    // ✅ Insert order
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

    // ✅ Queue message
    const queueCh = await interaction.client.channels.fetch(IDS.QUEUE_CHANNEL_ID);
    const qmsg = await queueCh.send(
      `🧾 New Order **${orderNo}** | <@${interaction.user.id}> | ${type}:${code} | ${amount}฿ | Ticket: <#${ticket.id}>`
    );
    await OrdersRepo.setQueueMessageId(orderNo, qmsg.id);

    // ✅ Ticket intro embed
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

    // ✅ Player model select (ถ้าแพ็กมีรถ/เรือให้เลือก)
    const components = [];
    if (type === "DONATE") {
      const p = DONATE_PACKS?.[code];
      const options = [];

      for (const v of (p?.vehicleChoices ?? [])) options.push({ label: `CAR: ${v}`, value: `CAR:${v}` });
      for (const b of (p?.boatChoices ?? [])) options.push({ label: `BOAT: ${b}`, value: `BOAT:${b}` });

      if (options.length) {
        const select = new StringSelectMenuBuilder()
          .setCustomId(`ticket_model_select:${orderNo}`)
          .setPlaceholder("เลือก model รถ/เรือ (ถ้ามี)")
          .addOptions(options);

        components.push(new ActionRowBuilder().addComponents(select));
      }
    }

    // ✅ Staff panel rows
    const staffRows = buildStaffPanel(orderNo);

    await ticket.send({
      content: `<@${interaction.user.id}>`,
      embeds: [intro],
      components: [...components, ...staffRows],
    });

    // ✅ ตอบกลับผู้ใช้ (หลัง deferReply ต้อง editReply)
    return interaction.editReply({
      content: `✅ สร้าง Ticket แล้ว: <#${ticket.id}> (Order: ${orderNo})`,
    });
  } catch (err) {
    console.error("createOrderFromModal error:", err);

    // ถ้าสร้าง ticket ไปแล้ว แต่ขั้นตอนอื่นล้ม ให้บอกผู้ใช้ชัด ๆ
    const extra = ticket?.id ? `\n⚠️ มีการสร้างห้อง Ticket แล้ว: <#${ticket.id}>` : "";
    const orderInfo = orderNo ? `\nOrder: ${orderNo}` : "";

    return interaction.editReply({
      content: `❌ ระบบขัดข้อง สร้างเคสไม่สำเร็จ กรุณาลองอีกครั้ง${orderInfo}${extra}`,
    });
  }
}
