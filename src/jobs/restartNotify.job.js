import { EmbedBuilder } from 'discord.js';
import { IDS } from '../config/constants.js';

const notifiedKeys = new Set();

function getBangkokNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function parseNumberList(value, fallback = []) {
  const text = String(value ?? '').trim();
  if (!text) return [...fallback];
  return [...new Set(text.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

function getNextRestartBangkok(scheduleHours) {
  const now = getBangkokNow();
  const currentMinutes = now.hour * 60 + now.minute;

  for (const hour of scheduleHours) {
    const targetMinutes = hour * 60;
    if (targetMinutes > currentMinutes) {
      return {
        year: now.year,
        month: now.month,
        day: now.day,
        hour,
        minute: 0,
        daysAhead: 0,
      };
    }
  }

  return {
    year: now.year,
    month: now.month,
    day: now.day + 1,
    hour: scheduleHours[0],
    minute: 0,
    daysAhead: 1,
  };
}

function getMinutesUntilNextRestart(scheduleHours) {
  const now = getBangkokNow();
  const next = getNextRestartBangkok(scheduleHours);
  const currentMinutes = now.hour * 60 + now.minute;
  const nextMinutes = next.hour * 60 + next.minute + (next.daysAhead * 24 * 60);
  return nextMinutes - currentMinutes;
}

function buildNotifyEmbed(minutesLeft, nextHour) {
  const title = '⏰ แจ้งเตือนรีเซิร์ฟ';
  const nextText = `${String(nextHour).padStart(2, '0')}:00 น.`;
  const isUrgent = minutesLeft <= 5;

  return new EmbedBuilder()
    .setColor(isUrgent ? 0xe67e22 : 0xf1c40f)
    .setTitle(title)
    .setDescription([
      `เซิร์ฟเวอร์จะปิดและเปิดใหม่ในอีก **${minutesLeft} นาที**`,
      `รอบรีถัดไปเวลา **${nextText}**`,
      '',
      'กรุณาออกจากบังเกอร์ และหยุดขับขี่ยานพาหนะก่อนถึงเวลารี',
    ].join('\n'))
    .setFooter({ text: 'ระบบแจ้งเตือนอัตโนมัติ' })
    .setTimestamp(new Date());
}

function cleanupNotificationCache(scheduleHours, notifyMinutes) {
  const valid = new Set();
  for (const hour of scheduleHours) {
    for (const minute of notifyMinutes) {
      valid.add(`${hour}-${minute}`);
    }
  }
  for (const key of notifiedKeys) {
    const parts = key.split('-');
    if (parts.length !== 2) {
      notifiedKeys.delete(key);
      continue;
    }
    const [, minute] = parts;
    if (!valid.has(key) && !Number.isFinite(Number(minute))) {
      notifiedKeys.delete(key);
    }
  }
}

export async function runRestartNotifyJob(client) {
  const scheduleHours = parseNumberList(IDS.RESTART_SCHEDULE_HOURS, [0, 3, 6, 9, 12, 15, 18, 21]);
  const notifyMinutes = parseNumberList(IDS.RESTART_NOTIFY_MINUTES, [60, 30, 5, 2, 1]);
  const channelId = IDS.RESTART_NOTIFY_CHANNEL_ID || IDS.SERVER_STATUS_CHANNEL_ID;

  if (!scheduleHours.length || !notifyMinutes.length || !channelId) {
    return { skipped: true, reason: 'missing_config' };
  }

  cleanupNotificationCache(scheduleHours, notifyMinutes);

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) {
    return { skipped: true, reason: 'invalid_channel' };
  }

  const now = getBangkokNow();
  const next = getNextRestartBangkok(scheduleHours);
  const diffMin = getMinutesUntilNextRestart(scheduleHours);

  if (!notifyMinutes.includes(diffMin)) {
    return { skipped: true, reason: 'not_time', minutesLeft: diffMin };
  }

  const cacheKey = `${next.hour}-${diffMin}`;
  if (notifiedKeys.has(cacheKey)) {
    return { skipped: true, reason: 'already_sent', minutesLeft: diffMin };
  }

  const embed = buildNotifyEmbed(diffMin, next.hour);
  await channel.send({ embeds: [embed] });
  notifiedKeys.add(cacheKey);

  // prune old keys when we're safely past a restart boundary
  if (now.minute > 2) {
    const keepHours = new Set(scheduleHours.map((h) => String(h)));
    for (const key of [...notifiedKeys]) {
      const [hourText] = key.split('-');
      if (!keepHours.has(hourText)) notifiedKeys.delete(key);
    }
  }

  return {
    skipped: false,
    sent: true,
    channelId,
    minutesLeft: diffMin,
    nextRestartHour: next.hour,
  };
}
