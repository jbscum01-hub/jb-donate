import { EmbedBuilder } from 'discord.js';
import { IDS } from '../config/constants.js';
import { AuditRepo } from '../db/repo/audit.repo.js';
import { getAnnounceRuntime, getAutoRestartMessage, sendRconAnnouncement } from '../services/rconAnnounce.service.js';

const DEFAULT_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const DEFAULT_NOTIFY_MINUTES = [60, 30, 5, 2, 1];
const sentCache = new Set();

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

function parseHours(value) {
  const hours = String(value ?? '')
    .split(',')
    .map((item) => Number(String(item).trim()))
    .filter((num) => Number.isInteger(num) && num >= 0 && num <= 23)
    .sort((a, b) => a - b);

  return hours.length ? [...new Set(hours)] : DEFAULT_HOURS;
}

function parseNotifyMinutes(value) {
  const minutes = String(value ?? '')
    .split(',')
    .map((item) => Number(String(item).trim()))
    .filter((num) => Number.isInteger(num) && num >= 1 && num <= 1440)
    .sort((a, b) => b - a);

  return minutes.length ? [...new Set(minutes)] : DEFAULT_NOTIFY_MINUTES;
}

function formatRestartClock(hour) {
  return `${String(hour).padStart(2, '0')}:00 น.`;
}

function getNextRestart(hours, now = new Date()) {
  const p = getBangkokParts(now);

  for (const hour of hours) {
    if (hour > p.hour || (hour === p.hour && p.minute === 0 && p.second === 0)) {
      return {
        year: p.year,
        month: p.month,
        day: p.day,
        hour,
        minute: 0,
      };
    }
  }

  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: hours[0],
    minute: 0,
  };
}

function getDiffMinutes(nextRestart, now = new Date()) {
  const p = getBangkokParts(now);
  const nowUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour - 7, p.minute, p.second);
  const nextUtc = Date.UTC(nextRestart.year, nextRestart.month - 1, nextRestart.day, nextRestart.hour - 7, nextRestart.minute, 0);
  return Math.floor((nextUtc - nowUtc) / 60000);
}

function makeCacheKey(nextRestart, minutesLeft) {
  return [
    nextRestart.year,
    String(nextRestart.month).padStart(2, '0'),
    String(nextRestart.day).padStart(2, '0'),
    String(nextRestart.hour).padStart(2, '0'),
    String(minutesLeft).padStart(3, '0'),
  ].join('-');
}

export async function runRestartNotifyJob(client) {
  const channelId = IDS.RESTART_NOTIFY_CHANNEL_ID || IDS.SERVER_STATUS_CHANNEL_ID;
  if (!channelId) return { skipped: true, reason: 'missing_channel' };

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return { skipped: true, reason: 'invalid_channel' };

  const hours = parseHours(IDS.RESTART_SCHEDULE_HOURS);
  const notifyMinutes = parseNotifyMinutes(IDS.RESTART_NOTIFY_MINUTES);
  const nextRestart = getNextRestart(hours);
  const diffMin = getDiffMinutes(nextRestart);

  if (diffMin < 0) return { skipped: true, reason: 'negative_diff', diffMin };

  const hitMinute = notifyMinutes.find((m) => diffMin === m);
  if (!hitMinute) return { skipped: true, reason: 'not_time', diffMin };

  const cacheKey = makeCacheKey(nextRestart, hitMinute);
  if (sentCache.has(cacheKey)) return { skipped: true, reason: 'already_sent', diffMin, cacheKey };

  const embed = new EmbedBuilder()
    .setColor(hitMinute <= 5 ? 0xe67e22 : 0xf1c40f)
    .setTitle('⏰ แจ้งเตือนรีเซิร์ฟ')
    .setDescription([
      `เซิร์ฟเวอร์จะรีในอีก **${hitMinute} นาที**`,
      '',
      `🕒 รอบรีถัดไป: **${formatRestartClock(nextRestart.hour)}**`,
      'กรุณาออกจากบังเกอร์ และหลีกเลี่ยงการขับขี่ยานพาหนะก่อนเซิร์ฟรี',
    ].join('\n'));

  await channel.send({ embeds: [embed] });

  let announceResult = { skipped: true, reason: 'auto_announce_disabled' };
  const announceRuntime = getAnnounceRuntime();
  if (announceRuntime.enabled && announceRuntime.autoEnabled) {
    announceResult = await sendRconAnnouncement(getAutoRestartMessage(hitMinute), { source: `auto_restart_${hitMinute}` });
    await AuditRepo.add({
      guildId: channel.guild?.id ?? null,
      actorId: null,
      actorTag: 'SYSTEM',
      action: 'ANNOUNCE_AUTO_SEND',
      target: 'SCUM_RCON',
      meta: {
        minutes_left: hitMinute,
        next_restart_hour: nextRestart.hour,
        ok: announceResult.ok,
        skipped: Boolean(announceResult.skipped),
        reason: announceResult.reason ?? null,
        cache_key: cacheKey,
      },
    }).catch(() => {});
  }

  sentCache.add(cacheKey);
  return { skipped: false, sent: true, diffMin, cacheKey, nextRestartHour: nextRestart.hour, announceResult };
}
