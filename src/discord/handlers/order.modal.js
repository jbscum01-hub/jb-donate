export async function createOrderFromModal(interaction) {
  // ✅ กัน Modal Submit timeout 100%
  await interaction.deferReply({ ephemeral: true });

  try {
    const [_, type, code] = interaction.customId.split(":");
    const ign = interaction.fields.getTextInputValue("ign").trim();
    const steam = interaction.fields.getTextInputValue("steam").trim();
    const note = (interaction.fields.getTextInputValue("note") || "").trim();

    if (!isSteamId17(steam)) {
      return interaction.editReply({ content: "❌ SteamID ต้องเป็นเลข 17 หลักเท่านั้น" });
    }

    let amount = 0;
    if (type === "DONATE") amount = DONATE_PACKS[code]?.price ?? 0;
    if (type === "BOOST") amount = BOOSTS[code]?.price ?? 0;
    if (type === "VIP") amount = VIP_PACKS[code]?.price ?? 0;

    if (!amount) return interaction.editReply({ content: "❌ ไม่พบแพ็กที่เลือก" });

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
      type, pack_code: code, amount,
      ign, steam_id: steam, note,
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
        { name: "Status", value: "PENDING", inline: true },
      );

    const components = [];

    // model select (player chooses model)
    if (type === "DONATE") {
      const p = DONATE_PACKS[code];
      const options = [];
      for (const v of (p.vehicleChoices ?? [])) options.push({ label: `CAR: ${v}`, value: `CAR:${v}` });
      for (const b of (p.boatChoices ?? [])) options.push({ label: `BOAT: ${b}`, value: `BOAT:${b}` });

      if (options.length) {
        const select = new StringSelectMenuBuilder()
          .setCustomId(`ticket_model_select:${orderNo}`)
          .setPlaceholder("เลือก model รถ/เรือ (ถ้ามี)")
          .addOptions(options);
        components.push(new ActionRowBuilder().addComponents(select));
      }
    }

    const staffRows = buildStaffPanel(orderNo);

    await ticket.send({
      content: `<@${interaction.user.id}>`,
      embeds: [intro],
      components: [...components, ...staffRows],
    });

    // ✅ ปิดงานด้วย editReply (เพราะเรา deferReply ไปแล้ว)
    return interaction.editReply({ content: `✅ สร้าง Ticket แล้ว: <#${ticket.id}> (Order: ${orderNo})` });

  } catch (err) {
    console.error("createOrderFromModal error:", err);
    return interaction.editReply({ content: "❌ ระบบขัดข้อง สร้างเคสไม่สำเร็จ กรุณาลองอีกครั้ง" });
  }
}
