import "dotenv/config";

const required = [
  "DISCORD_TOKEN",
  "DATABASE_URL",
  "SHOP_CHANNEL_ID",
  "QUEUE_CHANNEL_ID",
  "LOG_CHANNEL_ID",
  "VIP_LOG_CHANNEL_ID",
  "SLIP_ARCHIVE_CHANNEL_ID",
  "VEHICLE_PLATE_LOG_CHANNEL_ID",
  "ADMIN_ROLE_ID",
  "ADMIN_DASHBOARD_CHANNEL_ID",
  "ADMIN_DASHBOARD_MESSAGE_ID",
  "VIP_BASIC_ROLE_ID",
  "VIP_PRO_ROLE_ID",
  "VIP_ELITE_ROLE_ID",
  "TICKET_CATEGORY_ID",
];

for (const k of required) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  // trim ช่องว่าง/ขึ้นบรรทัด (พบบ่อยใน Render)
  process.env[k] = String(v).trim();
}

export const ENV = Object.fromEntries(required.map((k) => [k, process.env[k]]));
