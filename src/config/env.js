import "dotenv/config";

const required = [
  "DISCORD_TOKEN",
  "DATABASE_URL",
  "GUILD_ID",
  "SHOP_CHANNEL_ID",
  "QUEUE_CHANNEL_ID",
  "LOG_CHANNEL_ID",
  "VIP_LOG_CHANNEL_ID",
  "SLIP_ARCHIVE_CHANNEL_ID",
  "VEHICLE_PLATE_LOG_CHANNEL_ID",
  "ADMIN_ROLE_ID",
  "ADMIN_DASHBOARD_CHANNEL_ID",
  "VIP_BASIC_ROLE_ID",
  "VIP_PRO_ROLE_ID",
  "VIP_ELITE_ROLE_ID",
  "TICKET_CATEGORY_ID",
];

const optional = [
  "ADMIN_DASHBOARD_MESSAGE_ID",
  "SEND_ADMIN_DASHBOARD_ON_START",
  "PANEL_MESSAGE_ID",
  "SEND_PANEL_ON_START",
];

for (const k of required) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  process.env[k] = String(v).trim();
}

for (const k of optional) {
  const v = process.env[k];
  if (typeof v === "string") process.env[k] = v.trim();
}

export const ENV = {
  ...Object.fromEntries(required.map((k) => [k, process.env[k]])),
  ADMIN_DASHBOARD_MESSAGE_ID: process.env.ADMIN_DASHBOARD_MESSAGE_ID || "",
  SEND_ADMIN_DASHBOARD_ON_START: String(process.env.SEND_ADMIN_DASHBOARD_ON_START || "false").toLowerCase() === "true",
  PANEL_MESSAGE_ID: process.env.PANEL_MESSAGE_ID || "",
  SEND_PANEL_ON_START: String(process.env.SEND_PANEL_ON_START || "false").toLowerCase() === "true",
};
