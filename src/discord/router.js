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
import { openManualInsuranceModal, addManualInsuranceFromModal } from "./handlers/admin.addInsurance.js";
import {
  openCreatePackModal,
  createPackFromModal,
  openEditPackPicker,
  openPreviewPackPicker,
  openTogglePackPicker,
  openEditPackModalFromSelect,
  updatePackFromModal,
  previewPackFromSelect,
  togglePackFromSelect,
  refreshShopPanelFromAdmin,
} from "./handlers/admin.managePacks.js";

import { buildAdminDashboardMessage } from "./panels/adminDashboard.js";
import { buildShopPanel } from "./panels/shopPanel.js";
import { isAdmin } from "../domain/permissions.js";
import { ENV } from "../config/env.js";
import { runVipTick } from "../jobs/vipRunner.js";
import { isStaffActionId } from "./utils/customId.js";

async function getAdminDashboardMessage(client) {
  if (!ENV.ADMIN_DASHBOARD_CHANNEL_ID) throw new Error("Missing ENV.ADMIN_DASHBOARD_CHANNEL_ID");
  const ch = await client.channels.fetch(ENV.ADMIN_DASHBOARD_CHANNEL_ID);
  if (!ch) throw new Error("Cannot fetch admin dashboard channel");
  if (!ENV.ADMIN_DASHBOARD_MESSAGE_ID) throw new Error("Missing ENV.ADMIN_DASHBOARD_MESSAGE_ID");
  const msg = await ch.messages.fetch(ENV.ADMIN_DASHBOARD_MESSAGE_ID);
  if (!msg) throw new Error("Cannot fetch admin dashboard message");
  return msg;
}

async function rebuildShopPanel(client) {
  if (!ENV.SHOP_CHANNEL_ID) throw new Error("Missing ENV.SHOP_CHANNEL_ID");
  const ch = await client.channels.fetch(ENV.SHOP_CHANNEL_ID);
  if (!ch) throw new Error("Cannot fetch shop channel");
  const payload = await buildShopPanel();

  if (ENV.PANEL_MESSAGE_ID) {
    const oldMsg = await ch.messages.fetch(ENV.PANEL_MESSAGE_ID).catch(() => null);
    if (oldMsg) {
      await oldMsg.edit(payload);
      return oldMsg;
    }
  }

  const sent = await ch.send(payload);
  await sent.pin().catch(() => {});
  return sent;
}

export async function routeInteraction(interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "shop_select") return openOrderModal(interaction);
      if (interaction.customId === "admin:packs:edit_select") return openEditPackModalFromSelect(interaction);
      if (interaction.customId === "admin:packs:preview_select") return previewPackFromSelect(interaction);
      if (interaction.customId === "admin:packs:toggle_select") return togglePackFromSelect(interaction);
      if (interaction.customId.startsWith("ticket_model_select:")) return handleTicketVehicleSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("order_create:")) return createOrderFromModal(interaction);
      if (interaction.customId.startsWith("admin_add_insurance_modal:")) return addManualInsuranceFromModal(interaction);
      if (interaction.customId === "admin_pack_create_modal") return createPackFromModal(interaction);
      if (interaction.customId.startsWith("admin_pack_edit_modal:")) return updatePackFromModal(interaction);
      if (interaction.customId.startsWith("set_plate_modal:")) return setPlate(interaction);
      return;
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("admin:")) {
        if (!isAdmin(interaction.member)) {
          return interaction.reply({ content: "❌ เฉพาะแอดมินเท่านั้น", flags: MessageFlags.Ephemeral });
        }

        if (id.startsWith("admin:add_insurance:")) {
          return openManualInsuranceModal(interaction);
        }

        if (id.startsWith("admin:nav:")) {
          const view = id.split(":")[2] || "dashboard";
          const payload = await buildAdminDashboardMessage(interaction.client, view);
          return interaction.update(payload);
        }

        if (id === "admin:packs:create") return openCreatePackModal(interaction);
        if (id === "admin:packs:edit") return openEditPackPicker(interaction);
        if (id === "admin:packs:preview") return openPreviewPackPicker(interaction);
        if (id === "admin:packs:toggle") return openTogglePackPicker(interaction);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

        if (id === "admin:refresh") {
          const msg = await getAdminDashboardMessage(interaction.client);
          const payload = await buildAdminDashboardMessage(interaction.client, "dashboard");
          await msg.edit(payload);
          return interaction.editReply("✅ Refresh Dashboard แล้ว");
        }

        if (id === "admin:vip_tick") {
          const r = await runVipTick(interaction.client);
          return interaction.editReply(`✅ VIP Tick done: due=${r?.due ?? 0}, warn=${r?.warn ?? 0}, expired=${r?.expired ?? 0}`);
        }

        if (id === "admin:tool:post_shop" || id === "admin:tool:refresh_shop") {
          const sent = await rebuildShopPanel(interaction.client);
          return interaction.editReply(`✅ ส่ง Shop Panel แล้ว\nMessage ID: ${sent.id}\nChannel: <#${ENV.SHOP_CHANNEL_ID}>`);
        }

        if (id === "admin:tool:deploy_admin" || id === "admin:tool:rebuild_admin") {
          const ch = await interaction.client.channels.fetch(ENV.ADMIN_DASHBOARD_CHANNEL_ID);
          const payload = await buildAdminDashboardMessage(interaction.client, "dashboard");
          const sent = await ch.send(payload);
          return interaction.editReply(`✅ ส่ง Admin Panel ใหม่แล้ว\nMessage ID: ${sent.id}\nChannel: <#${ENV.ADMIN_DASHBOARD_CHANNEL_ID}>\n\nถ้าจะใช้ข้อความนี้เป็นหลัก ให้เอา ID ไปใส่ ADMIN_DASHBOARD_MESSAGE_ID`);
        }

        if (id === "admin:packs:refresh") return refreshShopPanelFromAdmin(interaction);

        if (
          id.startsWith("admin:insurance:") ||
          id.startsWith("admin:config:") ||
          id.startsWith("admin:logs:")
        ) {
          return interaction.editReply("🛠️ ปุ่มนี้เปิดโครงไว้แล้ว เพื่อให้เมนูแอดมินครบและไม่กดแล้วพัง ตอนนี้ยังไม่ได้ผูก modal / query viewer เต็ม");
        }

        return interaction.editReply("ℹ️ Admin action not implemented yet");
      }

      if (isStaffActionId(id, "approve")) return approveOrder(interaction);
      if (isStaffActionId(id, "gen")) return genCommands(interaction);
      if (id.startsWith("staff:set_plate:") || id.startsWith("staff_set_car_plate:") || id.startsWith("staff_set_boat_plate:")) return setPlate(interaction);
      if (isStaffActionId(id, "close")) return closeOrder(interaction);
      if (isStaffActionId(id, "cancel")) return cancelOrder(interaction);

      if (id.startsWith("vehiclecard_useins:") || id.startsWith("use_ins:")) return useInsuranceFromCard(interaction);
    }
  } catch (e) {
    console.error("routeInteraction error", e);
    const content = `❌ Error: ${e?.message || String(e)}`;
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content }).catch(() => {});
    }
    return interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
