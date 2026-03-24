import { EmbedBuilder, ActivityType } from 'discord.js';
import { IDS } from '../config/constants.js';
import { setRuntimeConfig, getRuntimeConfig } from '../config/runtimeConfig.js';
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

async function buildStatusEmbed(status) {
  const isOnline = status?.status === 'online';

  // 🔥 ดึง GIF จาก config
  const ONLINE_GIF = await getRuntimeConfig('SERVER_STATUS_GIF_ONLINE');
  const OFFLINE_GIF = await getRuntimeConfig('SERVER_STATUS_GIF_OFFLINE');

  const gifUrl = isOnline ? ONLINE_GIF : OFFLINE_GIF;

  if (!status) {
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('📊 SCUM SERVER STATUS')
      .setDescription('ไม่สามารถดึงข้อมูลเซิร์ฟเวอร์ได้')
      .addFields({ name: '📡 สถานะ', value: '🔴 Offline / fetch error', inline: false })
      .setImage(OFFLINE_GIF || null)
      .setFooter({ text: `อัปเดตล่าสุด: ${formatBangkokDate()}` });
  }

  const ipPort =
    status.ip && status.port && status.ip !== '-' && status.port !== '-'
      ? `${status.ip}:${status.port}`
      : status.connect || '-';

  return new EmbedBuilder()
    .setColor(isOnline ? 0x2ecc71 : 0xe74c3c)
    .setTitle('📊 SCUM SERVER STATUS')
    .setDescription([
      `**${status.name}**`,
      'ข้อมูลห้องนี้อัปเดตอัตโนมัติ',
      '',
      `📡 **สถานะเซิร์ฟเวอร์ :** ${isOnline ? '🟢 Online' : status.status}`,
      '',
      `👥 **ผู้เล่นออนไลน์ :** ${status.players}/${status.maxPlayers || '-'}`,
      '',
      `⏳ **คิวรอเข้า :** ${String(status.queue ?? 0)}`,
      '',
      `🌐 **IP / Port :** ${ipPort}`,
      '',
      'เวลารีสตาร์ทเซิฟเวอร์',  
      '⏰  08:00 น.',
      '⏰  12:00 น.',
﻿      '⏰﻿  18:00 น.',
﻿      '⏰﻿  21:00 น.',
﻿      '⏰﻿  00:00 น.',
      '',
      '******กรุณาออกจากบังเกอร์และหยุดขับขี่รถหยุดการกระทำก่อนเซิฟรี 5 นาที******                      ',
      '',
    ].join('\n'))
    .setImage(gifUrl || null) // 🔥 ตรงนี้คือ GIF
    .setFooter({ text: `อัปเดตล่าสุด: ${formatBangkokDate()}` });
}

export async function runServerStatusJob(client) {
  const channelId = IDS.SERVER_STATUS_CHANNEL_ID;
  const serverId = IDS.BATTLEMETRICS_SERVER_ID;

  if (!channelId || !serverId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;

  const status = await getScumServerStatus(serverId);

  // 🔥 ตั้งสถานะบอท
  if (client?.user) {
    const text =
      status?.status === 'online'
        ? `👥 Online ${status.players} Players`
        : '🔴 Offline';

    await client.user.setPresence({
      activities: [{ name: text, type: ActivityType.Watching }],
      status: 'online',
    });
  }

  const embed = await buildStatusEmbed(status);

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
    await setRuntimeConfig('SERVER_STATUS_MESSAGE_ID', created.id);
  } else {
    await message.edit({ embeds: [embed] });
  }
}
