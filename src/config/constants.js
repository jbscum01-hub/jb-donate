import { getRuntimeConfig } from "./runtimeConfig.js";

export const IDS = {
  get SHOP_CHANNEL_ID() { return getRuntimeConfig("SHOP_CHANNEL_ID"); },
  get QUEUE_CHANNEL_ID() { return getRuntimeConfig("QUEUE_CHANNEL_ID"); },
  get LOG_CHANNEL_ID() { return getRuntimeConfig("LOG_CHANNEL_ID"); },
  get VIP_LOG_CHANNEL_ID() { return getRuntimeConfig("VIP_LOG_CHANNEL_ID"); },
  get SLIP_ARCHIVE_CHANNEL_ID() { return getRuntimeConfig("SLIP_ARCHIVE_CHANNEL_ID"); },
  get VEHICLE_PLATE_LOG_CHANNEL_ID() { return getRuntimeConfig("VEHICLE_PLATE_LOG_CHANNEL_ID"); },

  get ADMIN_ROLE_ID() { return getRuntimeConfig("ADMIN_ROLE_ID"); },

  get ADMIN_DASHBOARD_CHANNEL_ID() { return getRuntimeConfig("ADMIN_DASHBOARD_CHANNEL_ID"); },
  get ADMIN_DASHBOARD_MESSAGE_ID() { return getRuntimeConfig("ADMIN_DASHBOARD_MESSAGE_ID"); },

  get VIP_BASIC_ROLE_ID() { return getRuntimeConfig("VIP_BASIC_ROLE_ID"); },
  get VIP_PRO_ROLE_ID() { return getRuntimeConfig("VIP_PRO_ROLE_ID"); },
  get VIP_ELITE_ROLE_ID() { return getRuntimeConfig("VIP_ELITE_ROLE_ID"); },

  get TICKET_CATEGORY_ID() { return getRuntimeConfig("TICKET_CATEGORY_ID"); },
  get PANEL_MESSAGE_ID() { return getRuntimeConfig("PANEL_MESSAGE_ID"); },
  get SHOP_QR_IMAGE_URL() { return getRuntimeConfig("SHOP_QR_IMAGE_URL"); },

  get BATTLEMETRICS_SERVER_ID() { return getRuntimeConfig("BATTLEMETRICS_SERVER_ID"); },
  get SERVER_STATUS_CHANNEL_ID() { return getRuntimeConfig("SERVER_STATUS_CHANNEL_ID"); },
  get SERVER_STATUS_MESSAGE_ID() { return getRuntimeConfig("SERVER_STATUS_MESSAGE_ID"); },
  get SERVER_STATUS_REFRESH_SECONDS() { return getRuntimeConfig("SERVER_STATUS_REFRESH_SECONDS", "60"); },
  get SERVER_STATUS_GIF_ONLINE() { return getRuntimeConfig("SERVER_STATUS_GIF_ONLINE"); },
  get SERVER_STATUS_GIF_OFFLINE() { return getRuntimeConfig("SERVER_STATUS_GIF_OFFLINE"); },
};
