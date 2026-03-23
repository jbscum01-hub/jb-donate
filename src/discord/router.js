import { MessageFlags } from "discord.js";
import { openOrderModal, previewShopPack } from "./handlers/shop.select.js";
import { createOrderFromModal } from "./handlers/order.modal.js";
import { handleTicketVehicleSelect } from "./handlers/ticket.vehicle.select.js";

import { approveOrder } from "./handlers/staff.approve.js";
import { genCommands } from "./handlers/staff.gen.js";
import { setPlate } from "./handlers/staff.setPlate.js";
import { closeOrder } from "./handlers/staff.close.js";
import { cancelOrder } from "./handlers/staff.cancel.js";

import { useInsuranceFromCard } from "./handlers/vehicleCard.useIns.js";
import { openManualInsuranceModal, addManualInsuranceFromModal } from "./handlers/admin.addInsurance.js";
import { handleInsuranceAdminButton, handleInsuranceAdminModal } from "./handlers/admin.insuranceTools.js";
import { handleLogsAdminButton } from "./handlers/admin.logs.js";
import { handleAdminSearchButton, handleAdminSearchModal } from "./handlers/admin.search.js";
import { handleManagePacksButton, handleManagePacksSelect, handleManagePacksModal } from "./handlers/admin.managePacks.js";
import { handleCashButton, handleCashModal } from "./handlers/admin.cash.js";

import { buildAdminDashboardMessage } from "./panels/adminDashboard.js";
import { buildShopPanels } from "./panels/shopPanel.js";
import { isAdmin } from "../domain/permissions.js";
import { IDS } from "../config/constants.js";
import { setRuntimeConfig } from "../config/runtimeConfig.js";
import { AuditRepo } from "../db/repo/audit.repo.js";
import { ShopPanelRepo } from "../db/repo/shopPanel.repo.js";
import { runVipTick } from "../jobs/vipRunner.js";
import { isStaffActionId } from "./utils/customId.js";

async function getAdminDashboardMessage(client) {
  const channelId = IDS.ADMIN_DASHBOARD_CHANNEL_ID;
  if (!channelId) throw new Error("Missing ADMIN_DASHBOARD_CHANNEL_ID (DB/ENV)");

  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch) throw new Error("Cannot fetch admin dashboard channel");

  const messageId = IDS.ADMIN_DASHBOARD_MESSAGE_ID;
  if (!messageId) throw new Error("Missing ADMIN_DASHBOARD_MESSAGE_ID (DB/ENV)");

  const msg = await ch.messages.fetch(messageId).catch(() => null);
  if (!msg) throw new Error(`Cannot fetch admin dashboard message: ${messageId}`);
  return msg;
}

async function rebuildShopPanel(client) {
  const channelId = IDS.SHOP_CHANNEL_ID;
  if (!channelId) throw new Error("Missing SHOP_CHANNEL_ID (DB/ENV)");

  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch) throw new Error("Cannot fetch shop channel");

  const panels = await buildShopPanels();
  const existing = await ShopPanelRepo.listByChannel(channelId);
  const existingMap = new Map(existing.map((row) => [row.panel_key, row]));

  const touchedKeys = [];
  const messages = [];
  let created = 0;
  let edited = 0;

  for (const [index, panel] of panels.entries()) {
    const existingRow = existingMap.get(panel.panelKey) ?? null;
    let msg = null;

    if (existingRow?.message_id) {
      msg = await ch.messages.fetch(existingRow.message_id).catch(() => null);
    }

    if (msg) {
      await msg.edit(panel.payload);
      edited += 1;
    } else {
      msg = await ch.send(panel.payload);
      created += 1;
      if (index === 0) {
        await msg.pin().catch(() => {});
      }
    }

    messages.push(msg);
    touchedKeys.push(panel.panelKey);

    await ShopPanelRepo.upsert({
      channelId,
      panelKey: panel.panelKey,
      packId: panel.packId,
      packCode: panel.packCode,
      messageId: msg.id,
      sortOrder: panel.sortOrder,
      isActive: true,
    });
  }

  const staleRows = await ShopPanelRepo.deactivateMissing(channelId, touchedKeys);
  let removed = 0;
  for (const row of staleRows) {
    const staleMsg = await ch.messages.fetch(row.message_id).catch(() => null);
    if (staleMsg) {
      await staleMsg.delete().catch(() => {});
      removed += 1;
    }
  }

  if (messages[0]?.id) {
    await setRuntimeConfig("PANEL_MESSAGE_ID", messages[0].id);
  }

  return {
    channelId,
    introMessage: messages[0] ?? null,
    messages,
    total: messages.length,
    created,
    edited,
    removed,
  };
}

async function deployAdminPanel(client) {
  const channelId = IDS.ADMIN_DASHBOARD_CHANNEL_ID;
  if (!channelId) throw new Error("Missing ADMIN_DASHBOARD_CHANNEL_ID (DB/ENV)");

  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch) throw new Error("Cannot fetch admin dashboard channel");

  const payload = await buildAdminDashboardMessage(client, "dashboard");
  const sent = await ch.send(payload);
  await sent.pin().catch(() => {});
  await setRuntimeConfig("ADMIN_DASHBOARD_CHANNEL_ID", ch.id);
  await setRuntimeConfig("ADMIN_DASHBOARD_MESSAGE_ID", sent.id);
  return sent;
}

export async function routeInteraction(interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "shop_select") return previewShopPack(interaction);
      if (interaction.customId.startsWith("ticket_model_select:")) return handleTicketVehicleSelect(interaction);
      if (interaction.customId.startsWith("admin:packs:select:")) return handleManagePacksSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("order_create:")) return createOrderFromModal(interaction);
      if (interaction.customId.startsWith("admin_add_insurance_modal:")) return addManualInsuranceFromModal(interaction);
      if (interaction.customId.startsWith("set_plate_modal:")) return setPlate(interaction);
      if (interaction.customId.startsWith("admin:packs:modal:")) return handleManagePacksModal(interaction);
      if (interaction.customId.startsWith("admin:insurance:modal:")) return handleInsuranceAdminModal(interaction);
      if (interaction.customId.startsWith("admin:search:modal:")) return handleAdminSearchModal(interaction);
      if (interaction.customId.startsWith("admin:cash:modal:")) return handleCashModal(interaction);
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

        if (id.startsWith("admin:packs:")) {
          return handleManagePacksButton(interaction, {
            refreshShopPanel: () => rebuildShopPanel(interaction.client),
          });
        }

        if (id.startsWith("admin:insurance:")) {
          return handleInsuranceAdminButton(interaction);
        }

        if (id.startsWith("admin:logs:")) {
          return handleLogsAdminButton(interaction);
        }

        if (id.startsWith("admin:search:")) {
          return handleAdminSearchButton(interaction);
        }

        if (id.startsWith("admin:cash:")) {
          return handleCashButton(interaction);
        }

        if (id.startsWith("admin:nav:")) {
          const view = id.split(":")[2] || "dashboard";
          const payload = await buildAdminDashboardMessage(interaction.client, view);
          return interaction.update(payload);
        }

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

        if (id === "admin:tool:refresh_shop") {
          const result = await rebuildShopPanel(interaction.client);
          const target = result?.introMessage?.id || IDS.PANEL_MESSAGE_ID || null;
          await AuditRepo.add({ guildId: interaction.guildId, actorId: interaction.user.id, actorTag: interaction.user.tag ?? interaction.user.username, action: "SHOP_PANEL_REFRESH", target, meta: { channel_id: IDS.SHOP_CHANNEL_ID, total: result.total, created: result.created, edited: result.edited, removed: result.removed } });
          return interaction.editReply(`✅ Refresh Shop Panels แล้ว\nPanels: ${result.total}\nCreated: ${result.created}\nEdited: ${result.edited}\nRemoved: ${result.removed}\nChannel: <#${IDS.SHOP_CHANNEL_ID}>`);
        }

        if (id === "admin:tool:post_shop") {
          const result = await rebuildShopPanel(interaction.client);
          const target = result?.introMessage?.id || IDS.PANEL_MESSAGE_ID || null;
          await AuditRepo.add({ guildId: interaction.guildId, actorId: interaction.user.id, actorTag: interaction.user.tag ?? interaction.user.username, action: "SHOP_PANEL_DEPLOY", target, meta: { channel_id: IDS.SHOP_CHANNEL_ID, total: result.total, created: result.created, edited: result.edited, removed: result.removed } });
          return interaction.editReply(`✅ Deploy Shop Panels แล้ว\nPanels: ${result.total}\nCreated: ${result.created}\nEdited: ${result.edited}\nRemoved: ${result.removed}\nChannel: <#${IDS.SHOP_CHANNEL_ID}>\n\nระบบได้อัปเดต PANEL_MESSAGE_ID ให้เป็นข้อความพาเนลแรกแล้ว`);
        }

        if (id === "admin:tool:rebuild_admin") {
          const msg = await getAdminDashboardMessage(interaction.client);
          const payload = await buildAdminDashboardMessage(interaction.client, "dashboard");
          await msg.edit(payload);
          await AuditRepo.add({ guildId: interaction.guildId, actorId: interaction.user.id, actorTag: interaction.user.tag ?? interaction.user.username, action: "ADMIN_PANEL_REBUILD", target: msg.id, meta: { channel_id: IDS.ADMIN_DASHBOARD_CHANNEL_ID } });
          return interaction.editReply(`✅ Rebuild Admin Panel แล้ว
Message ID: ${msg.id}
Channel: <#${IDS.ADMIN_DASHBOARD_CHANNEL_ID}>`);
        }

        if (id === "admin:tool:deploy_admin") {
          const sent = await deployAdminPanel(interaction.client);
          await AuditRepo.add({ guildId: interaction.guildId, actorId: interaction.user.id, actorTag: interaction.user.tag ?? interaction.user.username, action: "ADMIN_PANEL_DEPLOY", target: sent.id, meta: { channel_id: IDS.ADMIN_DASHBOARD_CHANNEL_ID } });
          return interaction.editReply(`✅ ส่ง Admin Panel ใหม่แล้ว
Message ID: ${sent.id}
Channel: <#${IDS.ADMIN_DASHBOARD_CHANNEL_ID}>

ระบบได้บันทึก ADMIN_DASHBOARD_MESSAGE_ID ลง DB ให้แล้ว`);
        }

        if (id.startsWith("admin:config:")) {
          return interaction.editReply("🛠️ ปุ่มนี้เปิดโครงไว้แล้ว เพื่อให้เมนูแอดมินครบและไม่กดแล้วพัง ตอนนี้ยังไม่ได้ผูก modal / query viewer เต็ม");
        }

        return interaction.editReply("ℹ️ Admin action not implemented yet");
      }

      if (id.startsWith("shop:buy:")) {
        const [, , type, code] = id.split(":");
        return openOrderModal(interaction, `${type}:${code}`);
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
