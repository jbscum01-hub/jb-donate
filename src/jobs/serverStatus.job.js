import { EmbedBuilder } from 'discord.js';
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

  const embed = new EmbedBuilder()
    .setColor(isOnline ? 0x2ecc71 : 0xe74c3c)
    .setTitle('📊 SCUM SERVER STATUS')
    .setDescription(status
      ? `**${status.name}**\nข้อมูลห้องนี้อัปเดตอัตโนมัติ`
      : 'ไม่สามารถดึงข้อมูลเซิร์ฟเวอร์ได้ในตอนนี้')
    .setFooter({ text: `อัปเดตล่าสุด: ${formatBangkokDate()}` });

  if (!status) {
    embed.addFields({ name: '📡 สถานะ', value: 'offline / fetch error', inline: true });
    return embed;
  }

  embed.addFields(
    { name: '📡 สถานะ', value: isOnline ? 'ออนไลน์' : status.status, inline: true },
    { name: '👥 ผู้เล่นออนไลน์', value: `${status.players}/${status.maxPlayers || '-'}`, inline: true },
    { name: '⏳ คิวรอเข้า', value: String(status.queue ?? 0), inline: true },
    { name: '🗺️ แผนที่', value: status.map || '-', inline: true },
    { name: '🌐 IP / Port', value: status.ip !== '-' || status.port !== '-' ? `${status.ip}:${status.port}` : '-', inline: true },
    { name: '🏳️ โซน', value: status.country || '-', inline: true },
  );

  if (status.version && status.version !== '-') {
    embed.addFields({ name: '🧩 เวอร์ชัน', value: status.version, inline: true });
  }
  if (status.rank && status.rank !== '-') {
    embed.addFields({ name: '📈 Rank', value: status.rank, inline: true });
  }

  return embed;
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
