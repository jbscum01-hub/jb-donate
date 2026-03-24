import { ENV } from "./env.js";
import { DiscordConfigRepo } from "../db/repo/discordConfig.repo.js";

const cache = new Map();
let loaded = false;
let loadError = null;

const CONFIG_META = {
  SHOP_CHANNEL_ID: "Shop Channel",
  PANEL_MESSAGE_ID: "Shop Panel Message",
  SHOP_QR_IMAGE_URL: "Shop QR Image URL",
  ADMIN_DASHBOARD_CHANNEL_ID: "Admin Dashboard Channel",
  ADMIN_DASHBOARD_MESSAGE_ID: "Admin Dashboard Message",
  ADMIN_ROLE_ID: "Admin Role",
  QUEUE_CHANNEL_ID: "Queue Channel",
  LOG_CHANNEL_ID: "Order Log Channel",
  VIP_LOG_CHANNEL_ID: "VIP Log Channel",
  SLIP_ARCHIVE_CHANNEL_ID: "Slip Archive Channel",
  VEHICLE_PLATE_LOG_CHANNEL_ID: "Vehicle Plate Log Channel",
  TICKET_CATEGORY_ID: "Ticket Category",
  BATTLEMETRICS_SERVER_ID: "BattleMetrics Server ID",
  SERVER_STATUS_CHANNEL_ID: "Server Status Channel",
  SERVER_STATUS_MESSAGE_ID: "Server Status Message",
  SERVER_STATUS_REFRESH_SECONDS: "Server Status Refresh Seconds",
  SERVER_STATUS_GIF_ONLINE: "Server Status GIF Online",
  SERVER_STATUS_GIF_OFFLINE: "Server Status GIF Offline",
  RESTART_NOTIFY_CHANNEL_ID: "Restart Notify Channel",
  RESTART_SCHEDULE_HOURS: "Restart Schedule Hours",
  RESTART_NOTIFY_MINUTES: "Restart Notify Minutes",
  ANNOUNCE_ENABLED: "Announce Enabled",
  ANNOUNCE_AUTO_ENABLED: "Auto Announce Enabled",
  ANNOUNCE_ADMIN_COMMAND_ENABLED: "Admin Announce Command Enabled",
  ANNOUNCE_ECHO_TO_CHANNEL_ENABLED: "Announce Echo To Channel Enabled",
  ANNOUNCE_RCON_HOST: "Announce RCON Host",
  ANNOUNCE_RCON_PORT: "Announce RCON Port",
  ANNOUNCE_RCON_PASSWORD: "Announce RCON Password",
  ANNOUNCE_RCON_LOGIN_DELAY_MS: "Announce RCON Login Delay Ms",
  ANNOUNCE_RCON_SEND_DELAY_MS: "Announce RCON Send Delay Ms",
  ANNOUNCE_RCON_CLOSE_DELAY_MS: "Announce RCON Close Delay Ms",
  ANNOUNCE_RCON_COMMAND_PREFIX: "Announce RCON Command Prefix",
  ANNOUNCE_ADMIN_COMMAND_PREFIX: "Admin Announce Command Prefix",
  ANNOUNCE_MESSAGE_30: "Announce Message 30 Minutes",
  ANNOUNCE_MESSAGE_5: "Announce Message 5 Minutes",
  ANNOUNCE_MESSAGE_2: "Announce Message 2 Minutes",
  ANNOUNCE_MESSAGE_1: "Announce Message 1 Minute",
};

export async function loadRuntimeDiscordConfig() {
  try {
    const rows = await DiscordConfigRepo.listActive();
    cache.clear();
    for (const row of rows) {
      if (!row?.config_key) continue;
      cache.set(String(row.config_key).trim(), String(row.config_value ?? "").trim());
    }
    loaded = true;
    loadError = null;
    return snapshotRuntimeDiscordConfig();
  } catch (err) {
    loaded = true;
    loadError = err;
    console.error("loadRuntimeDiscordConfig error:", err);
    return snapshotRuntimeDiscordConfig();
  }
}

export function getRuntimeConfig(key, fallback = "") {
  if (cache.has(key)) return cache.get(key) || fallback;
  const envValue = ENV[key];
  if (typeof envValue === "string" && envValue.trim()) return envValue.trim();
  return fallback;
}

export function snapshotRuntimeDiscordConfig(keys = Object.keys(CONFIG_META)) {
  return Object.fromEntries(keys.map((key) => [key, getRuntimeConfig(key, "")]));
}

export async function setRuntimeConfig(key, value, { displayName = CONFIG_META[key] || key, isActive = true } = {}) {
  const row = await DiscordConfigRepo.set(key, value, { displayName, isActive });
  cache.set(key, String(row?.config_value ?? value ?? "").trim());
  return cache.get(key);
}

export function hasLoadedRuntimeDiscordConfig() {
  return loaded;
}

export function getRuntimeDiscordConfigError() {
  return loadError;
}
