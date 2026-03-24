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

function buildStatusEmbed(status) {
  const isOnline = status?.status === 'online';

  if (!status) {
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('📊 SCUM SERVER STATUS')
      .setDescription('ไม่สามารถดึงข้อมูลเซิร์ฟเวอร์ได้ในตอนนี้')
      .addFields({ name: '📡 สถานะ', value: '🔴 Offline / fetch error', inline: false })
      .setFooter({ text: `อัปเดตล่าสุด: ${formatBangkokDate()}` });
  }

  const ipPort =
    status.ip && status.port && status.ip !== '-' && status.port !== '-'
      ? `${status.ip}:${status.port}`
      : '-';

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
    .setFooter({ text: `อัปเดตล่าสุด: ${formatBangkokDate()}` });
}

export async function runServerStatusJob(client) {
  const channelId = IDS.SERVER_STATUS_CHANNEL_ID;
  const serverId = IDS.BATTLEMETRICS_SERVER_ID;

  if (!channelId || !serverId) return { skipped: true, reason: 'missing_config' };

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) {
    console.warn('⚠️ SERVER_STATUS_CHANNEL_ID is invalid or not text-based:', channelId);
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
    await created.pin().catch(() => {});
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
