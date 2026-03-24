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
  get RESTART_NOTIFY_CHANNEL_ID() { return getRuntimeConfig("RESTART_NOTIFY_CHANNEL_ID"); },
  get RESTART_SCHEDULE_HOURS() { return getRuntimeConfig("RESTART_SCHEDULE_HOURS", "0,3,6,9,12,15,18,21"); },
  get RESTART_NOTIFY_MINUTES() { return getRuntimeConfig("RESTART_NOTIFY_MINUTES", "60,30,5,2,1"); },

  get ANNOUNCE_ENABLED() { return getRuntimeConfig("ANNOUNCE_ENABLED", "false"); },
  get ANNOUNCE_AUTO_ENABLED() { return getRuntimeConfig("ANNOUNCE_AUTO_ENABLED", "true"); },
  get ANNOUNCE_ADMIN_COMMAND_ENABLED() { return getRuntimeConfig("ANNOUNCE_ADMIN_COMMAND_ENABLED", "true"); },
  get ANNOUNCE_ECHO_TO_CHANNEL_ENABLED() { return getRuntimeConfig("ANNOUNCE_ECHO_TO_CHANNEL_ENABLED", "true"); },
  get ANNOUNCE_RCON_HOST() { return getRuntimeConfig("ANNOUNCE_RCON_HOST"); },
  get ANNOUNCE_RCON_PORT() { return getRuntimeConfig("ANNOUNCE_RCON_PORT", "0"); },
  get ANNOUNCE_RCON_PASSWORD() { return getRuntimeConfig("ANNOUNCE_RCON_PASSWORD"); },
  get ANNOUNCE_RCON_LOGIN_DELAY_MS() { return getRuntimeConfig("ANNOUNCE_RCON_LOGIN_DELAY_MS", "350"); },
  get ANNOUNCE_RCON_SEND_DELAY_MS() { return getRuntimeConfig("ANNOUNCE_RCON_SEND_DELAY_MS", "350"); },
  get ANNOUNCE_RCON_CLOSE_DELAY_MS() { return getRuntimeConfig("ANNOUNCE_RCON_CLOSE_DELAY_MS", "1000"); },
  get ANNOUNCE_RCON_COMMAND_PREFIX() { return getRuntimeConfig("ANNOUNCE_RCON_COMMAND_PREFIX", "#announce"); },
  get ANNOUNCE_ADMIN_COMMAND_PREFIX() { return getRuntimeConfig("ANNOUNCE_ADMIN_COMMAND_PREFIX", "!announce"); },
  get ANNOUNCE_MESSAGE_30() { return getRuntimeConfig("ANNOUNCE_MESSAGE_30", "⏰ เซิร์ฟเวอร์จะรีในอีก 30 นาที"); },
  get ANNOUNCE_MESSAGE_5() { return getRuntimeConfig("ANNOUNCE_MESSAGE_5", "⏰ เซิร์ฟเวอร์จะรีในอีก 5 นาที"); },
  get ANNOUNCE_MESSAGE_2() { return getRuntimeConfig("ANNOUNCE_MESSAGE_2", "⏰ เซิร์ฟเวอร์จะรีในอีก 2 นาที"); },
  get ANNOUNCE_MESSAGE_1() { return getRuntimeConfig("ANNOUNCE_MESSAGE_1", "⏰ เซิร์ฟเวอร์จะรีในอีก 1 นาที"); },
};
