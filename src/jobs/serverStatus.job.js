import { EmbedBuilder, ActivityType } from 'discord.js';
import { IDS } from '../config/constants.js';
import { setRuntimeConfig } from '../config/runtimeConfig.js';
import { getScumServerStatus } from '../services/scumServer.service.js';

function formatBangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function isValidUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveImageUrl(isOnline) {
  const candidate = isOnline ? IDS.SERVER_STATUS_GIF_ONLINE : IDS.SERVER_STATUS_GIF_OFFLINE;
  return isValidUrl(candidate) ? String(candidate).trim() : null;
}

function buildLines(status) {
  if (!status) {
    return [
      'ไม่สามารถดึงข้อมูลเซิร์ฟเวอร์ได้ในตอนนี้',
      '',
      '📡 **สถานะ:** 🔴 Offline / fetch error',
    ];
  }

  const isOnline = status.status === 'online';
  const ipPort =
    status.ip && status.port && status.ip !== '-' && status.port !== '-'
      ? `${status.ip}:${status.port}`
      : (status.connect || '-');

  return [
    `**${status.name}**`,
    'ข้อมูลห้องนี้อัปเดตอัตโนมัติ',
    '',
    `📡 **สถานะ:** ${isOnline ? '🟢 ออนไลน์' : `🔴 ${status.status}`}`,
    `👥 **ผู้เล่นออนไลน์:** ${status.players}/${status.maxPlayers || '-'}`,
    `⏳ **คิวรอเข้า:** ${String(status.queue ?? 0)}`,
    `🌐 **IP / Port:** ${ipPort}`,
    '',
    '**เวลารีสตาร์ทเซิร์ฟเวอร์**',
    '⏰ 08:00 น.',
    '⏰ 12:00 น.',
    '⏰ 18:00 น.',
    '⏰ 21:00 น.',
    '⏰ 00:00 น.',
    '',
    '***กรุณาออกจากบังเกอร์ และหยุดขับขี่รถก่อนเซิร์ฟรี 5 นาที***',
  ];
}

function buildStatusEmbed(status) {
  const isOnline = status?.status === 'online';
  const embed = new EmbedBuilder()
    .setColor(isOnline ? 0x2ecc71 : 0xe74c3c)
    .setTitle('📊 SCUM SERVER STATUS')
    .setDescription(buildLines(status).join('\n'))
    .setFooter({ text: `อัปเดตล่าสุด: ${formatBangkokDate()}` });

  const imageUrl = resolveImageUrl(isOnline);
  if (imageUrl) embed.setImage(imageUrl);

  return embed;
}

export async function runServerStatusJob(client) {
  const channelId = IDS.SERVER_STATUS_CHANNEL_ID;
  const serverId = IDS.BATTLEMETRICS_SERVER_ID;

  if (!channelId || !serverId) {
    return { skipped: true, reason: 'missing_config' };
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) {
    console.warn('⚠️ SERVER_STATUS_CHANNEL_ID ไม่ถูกต้อง หรือไม่ใช่ห้องข้อความ:', channelId);
    return { skipped: true, reason: 'invalid_channel' };
  }

  const status = await getScumServerStatus(serverId);

  if (client?.user) {
    const presenceText =
      status?.status === 'online'
        ? `👥 Online ${status.players} Players`
        : '🔴 Offline';

    await client.user.setPresence({
      activities: [{ name: presenceText, type: ActivityType.Watching }],
      status: 'online',
    });
  }

  const embed = buildStatusEmbed(status);

  let message = null;
  const existingMessageId = IDS.SERVER_STATUS_MESSAGE_ID;

  if (existingMessageId) {
    message = await channel.messages.fetch(existingMessageId).catch(() => null);
  }

  if (!message) {
    const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (messages?.size) {
      message = messages.find((msg) => msg.author?.id === client.user?.id) || null;
    }
  }

  if (!message) {
    const created = await channel.send({ embeds: [embed] });
    await setRuntimeConfig('SERVER_STATUS_CHANNEL_ID', channel.id);
    await setRuntimeConfig('SERVER_STATUS_MESSAGE_ID', created.id);
    console.log('✅ Server status message created:', created.id);
    return { skipped: false, created: true, messageId: created.id, status: status?.status || 'unknown' };
  }

  await message.edit({ embeds: [embed] });

  if (existingMessageId !== message.id) {
    await setRuntimeConfig('SERVER_STATUS_CHANNEL_ID', channel.id);
    await setRuntimeConfig('SERVER_STATUS_MESSAGE_ID', message.id);
  }

  return { skipped: false, created: false, messageId: message.id, status: status?.status || 'unknown' };
}
