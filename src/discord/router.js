// src/discord/router.js
import { MessageFlags } from "discord.js";
import { openOrderModal } from "./handlers/shop.select.js";
import { createOrderFromModal } from "./handlers/order.modal.js";
import { handleTicketVehicleSelect } from "./handlers/ticket.vehicle.select.js";

import { approveOrder } from "./handlers/staff.approve.js";
import { genCommands } from "./handlers/staff.gen.js";
import { setPlate } from "./handlers/staff.setPlate.js";
import { closeOrder } from "./handlers/staff.close.js";
import { cancelOrder } from "./handlers/staff.cancel.js";

import { useInsuranceFromCard } from "./handlers/vehicleCard.useIns.js";

import { buildAdminDashboardMessage } from "./panels/adminDashboard.js";
import { buildShopPanel } from "./panels/shopPanel.js";
import { isAdmin } from "../domain/permissions.js";
import { ENV } from "../config/env.js";
import { runVipTick } from "../jobs/vipRunner.js";


async function rebuildShopPanel(client) {
  if (!ENV.SHOP_CHANNEL_ID) throw new Error("Missing ENV.SHOP_CHANNEL_ID");
  const ch = await client.channels.fetch(ENV.SHOP_CHANNEL_ID);
  const payload = buildShopPanel();

  // ส่ง panel ใหม่ (ปลอดภัยสุด เพราะ message เก่าอาจมี customId/version เก่า)
  const sent = await ch.send(payload);

  // พยายามปักหมุด (ถ้ามีสิทธิ์)
  await sent.pin().catch(() => {});
  return sent;
}


export async function routeInteraction(interaction) {
  try {
    // Select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "shop_select") return openOrderModal(interaction);
      if (interaction.customId.startsWith("ticket_model_select:")) return handleTicketVehicleSelect(interaction);
      return;
    }

    // Modal submits
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("order_create:")) return createOrderFromModal(interaction);

      // plate modals
      if (interaction.customId.startsWith("set_plate_modal:")) return setPlate(interaction);

      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const id = interaction.customId;


      // ===== Admin Dashboard Buttons =====
      if (id.startsWith("admin:")) {
        if (!isAdmin(interaction.member)) {
          return interaction.reply({ content: "❌ เฉพาะแอดมินเท่านั้น", flags: MessageFlags.Ephemeral });
        }

        // กัน timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

        if (id === "admin:refresh") {
          const ch = await interaction.client.channels.fetch(ENV.ADMIN_DASHBOARD_CHANNEL_ID);
          const msg = await ch.messages.fetch(ENV.ADMIN_DASHBOARD_MESSAGE_ID);
          const payload = await buildAdminDashboardMessage(interaction.client);
          await msg.edit(payload);
          return interaction.editReply("✅ Refresh Dashboard แล้ว");
        }

        if (id === "admin:vip_tick") {
          const r = await runVipTick(interaction.client);
          return interaction.editReply(`✅ VIP Tick done: due=${r?.due ?? 0}, warn=${r?.warn ?? 0}, expired=${r?.expired ?? 0}`);
        }

        if (id === "admin:health") {
          return interaction.editReply("🟢 Bot is running / gateway OK");
        }

        if (id === "admin:show_env") {
          const safe = [
            `GUILD_ID=${ENV.GUILD_ID}`,
            `SHOP_CHANNEL_ID=${ENV.SHOP_CHANNEL_ID}`,
            `QUEUE_CHANNEL_ID=${ENV.QUEUE_CHANNEL_ID}`,
            `LOG_CHANNEL_ID=${ENV.LOG_CHANNEL_ID}`,
            `VIP_LOG_CHANNEL_ID=${ENV.VIP_LOG_CHANNEL_ID}`,
            `SLIP_ARCHIVE_CHANNEL_ID=${ENV.SLIP_ARCHIVE_CHANNEL_ID}`,
            `ADMIN_ROLE_ID=${ENV.ADMIN_ROLE_ID}`,
            `ADMIN_DASHBOARD_CHANNEL_ID=${ENV.ADMIN_DASHBOARD_CHANNEL_ID}`,
            `ADMIN_DASHBOARD_MESSAGE_ID=${ENV.ADMIN_DASHBOARD_MESSAGE_ID}`,
            `TICKET_CATEGORY_ID=${ENV.TICKET_CATEGORY_ID}`,
          ].join("\n");
          return interaction.editReply("```env\n" + safe + "\n```");
        }

        if (id === "admin:rebuild_shop") {
          const sent = await rebuildShopPanel(interaction.client);
          return interaction.editReply(`✅ ส่ง Shop Panel ใหม่แล้ว\n${sent.url}\n\nℹ️ แนะนำให้ลบ/ปลดหมุด Shop Panel เก่าในห้อง donate-shop เพื่อกันคนกดอันเก่า`);
        }


        if (id === "admin:rebuild_panels") {
          const sent = await rebuildShopPanel(interaction.client).catch((e) => {
            throw new Error("Rebuild Shop Panel failed: " + (e?.message || String(e)));
          });

          // refresh dashboard message ด้วย
          const ch = await interaction.client.channels.fetch(ENV.ADMIN_DASHBOARD_CHANNEL_ID);
          const msg = await ch.messages.fetch(ENV.ADMIN_DASHBOARD_MESSAGE_ID);
          const payload = await buildAdminDashboardMessage(interaction.client);
          await msg.edit(payload);

          return interaction.editReply(`✅ Rebuild Panels เสร็จแล้ว\n- Shop Panel: ${sent.url}\n- Dashboard: refreshed`);
        }

        return interaction.editReply("⚠️ ไม่รู้จักปุ่มนี้");
      }

      if (id.startsWith("staff_approve:")) return approveOrder(interaction);
      if (id.startsWith("staff_gen:")) return genCommands(interaction);

      // SET PLATE (new)
      if (id.startsWith("staff_set_car_plate:")) return setPlate(interaction);
      if (id.startsWith("staff_set_boat_plate:")) return setPlate(interaction);

      // SET PLATE (old fallback)
      if (id.startsWith("staff_set_plate:")) return setPlate(interaction);

      if (id.startsWith("staff_close:")) return closeOrder(interaction);
      if (id.startsWith("staff_cancel:")) return cancelOrder(interaction);

      if (id.startsWith("vehiclecard_useins:")) return useInsuranceFromCard(interaction);

      return;
    }
  } catch (err) {
    console.error("routeInteraction error:", err);
    // try not to crash
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ มีข้อผิดพลาด (ดู log)", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}
