import { EmbedBuilder, ActivityType } from 'discord.js';
import { IDS } from '../config/constants.js';
import { setRuntimeConfig } from '../config/runtimeConfig.js';
import { getScumServerStatus } from '../services/scumServer.service.js';

const DEFAULT_RESTART_HOURS = [1, 4, 7, 10, 13, 16, 19, 22];
const RESTART_OPEN_NOTIFY_WINDOW_MINUTES = 20;

let lastKnownServerState = null;
let lastOpenedNotifyKey = '';

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

function getBangkokParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function parseRestartHours(value) {
  const hours = String(value ?? '')
    .split(',')
    .map((item) => Number(String(item).trim()))
    .filter((num) => Number.isInteger(num) && num >= 0 && num <= 23)
    .sort((a, b) => a - b);

  return hours.length ? [...new Set(hours)] : DEFAULT_RESTART_HOURS;
}

function normalizeImageUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return '';
  return url;
}

function buildLines(status) {
  const isOnline = status?.status === 'online';
  const ipPort = status?.ip && status?.port && status.ip !== '-' && status.port !== '-'
    ? `${status.ip}:${status.port}`
    : status?.connect || '-';

  return [
    `**${status?.name || 'SCUM Server'}**`,
    'ข้อมูลห้องนี้อัปเดตอัตโนมัติ',
    '',
    `📡 **สถานะ:** ${isOnline ? '🟢 ออนไลน์' : `🔴 ${status?.status || 'offline'}`}`,
    '',
    `👥 **ผู้เล่นออนไลน์:** ${status?.players ?? 0}/${status?.maxPlayers || '-'}`,
    '',
    `⏳ **คิวรอเข้า:** ${String(status?.queue ?? 0)}`,
    '',
    `🌐 **IP / Port:** ${ipPort}`,
    '',
    'เวลารีสตาร์ทเซิร์ฟเวอร์ ทุก 3 ชั่วโมง',
    '⏰ 00:00 น.',
    '⏰ 03:00 น.',
    '⏰ 06:00 น.',
    '⏰ 09:00 น.',
    '⏰ 12:00 น.',
    '⏰ 15:00 น.',
    '⏰ 18:00 น.',
    '⏰ 21:00 น.',
    '',
    '*กรุณาออกจากบังเกอร์ และหยุดขับขี่ยานพาหนะก่อนเซิร์ฟรี 5 นาที*',
  ];
}

function buildStatusEmbed(status) {
  const isOnline = status?.status === 'online';
  const onlineImage = normalizeImageUrl(IDS.SERVER_STATUS_GIF_ONLINE);
  const offlineImage = normalizeImageUrl(IDS.SERVER_STATUS_GIF_OFFLINE);
  const imageUrl = isOnline ? onlineImage : offlineImage;

  const embed = new EmbedBuilder()
    .setColor(isOnline ? 0x2ecc71 : 0xe74c3c)
    .setTitle('📊 SCUM SERVER STATUS')
    .setFooter({ text: `อัปเดตล่าสุด: ${formatBangkokDate()}` });

  if (!status) {
    embed
      .setDescription('ไม่สามารถดึงข้อมูลเซิร์ฟเวอร์ได้ในตอนนี้')
      .addFields({ name: '📡 สถานะ', value: '🔴 offline / fetch error', inline: false });
  } else {
    embed.setDescription(buildLines(status).join('\n'));
  }

  if (imageUrl) {
    embed.setImage(imageUrl);
    console.log('📷 Server status image:', imageUrl);
  }

  return embed;
}

function getRestartWindowInfo(now = new Date()) {
  const p = getBangkokParts(now);
  const restartHours = parseRestartHours(IDS.RESTART_SCHEDULE_HOURS);

  for (const hour of restartHours) {
    if (p.hour === hour && p.minute >= 2 && p.minute <= RESTART_OPEN_NOTIFY_WINDOW_MINUTES) {
      return {
        key: `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}-${String(hour).padStart(2, '0')}`,
        hour,
      };
    }
  }

  return null;
}

async function notifyServerOpened(client, status) {
  const channelId = IDS.RESTART_NOTIFY_CHANNEL_ID || IDS.SERVER_STATUS_CHANNEL_ID;
  if (!channelId) return false;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return false;

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🟢 เซิร์ฟเวอร์กลับมาออนไลน์แล้ว')
    .setDescription([
      `**${status?.name || 'SCUM Server'}** เปิดให้เข้าเล่นได้ตามปกติแล้ว`,
      '',
      '🚪 สามารถเข้าเซิร์ฟได้เลย',
    ].join('\n'))
    .setFooter({ text: `ตรวจพบการกลับมาออนไลน์เวลา ${formatBangkokDate()}` });

  await channel.send({ embeds: [embed] });
  return true;
}

export async function runServerStatusJob(client) {
  const channelId = IDS.SERVER_STATUS_CHANNEL_ID;
  const serverId = IDS.BATTLEMETRICS_SERVER_ID;

  if (!channelId || !serverId) return { skipped: true, reason: 'missing_config' };

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return { skipped: true, reason: 'invalid_channel' };

  const status = await getScumServerStatus(serverId);
  const currentState = status?.status === 'online' ? 'online' : 'offline';
  const previousState = lastKnownServerState;
  let openedNotifySent = false;

  const restartWindow = getRestartWindowInfo();
  if (
    currentState === 'online' &&
    restartWindow &&
    restartWindow.key !== lastOpenedNotifyKey &&
    (previousState === 'offline' || previousState === null || previousState === 'online')
  ) {
    openedNotifySent = await notifyServerOpened(client, status);
    if (openedNotifySent) {
      lastOpenedNotifyKey = restartWindow.key;
    }
  }

  lastKnownServerState = currentState;

  if (client?.user) {
    const presenceText = status?.status === 'online'
      ? `👥 Online ${status.players}/${status.maxPlayers || '-'} Players`
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
    await created.pin().catch(() => {});
    await setRuntimeConfig('SERVER_STATUS_CHANNEL_ID', channel.id);
    await setRuntimeConfig('SERVER_STATUS_MESSAGE_ID', created.id);
    return {
      skipped: false,
      created: true,
      messageId: created.id,
      status: currentState,
      openedNotifySent,
    };
  }

  await message.edit({ embeds: [embed] });

  if (existingMessageId !== message.id) {
    await setRuntimeConfig('SERVER_STATUS_CHANNEL_ID', channel.id);
    await setRuntimeConfig('SERVER_STATUS_MESSAGE_ID', message.id);
  }

  return {
    skipped: false,
    created: false,
    messageId: message.id,
    status: currentState,
    openedNotifySent,
  };
}
