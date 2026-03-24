const { getServerStatus } = require('../services/scumServer.service');
const { ActivityType } = require('discord.js');

async function runServerStatusJob(client, configRepo) {
  const serverId = await configRepo.get('BATTLEMETRICS_SERVER_ID');
  const channelId = await configRepo.get('SERVER_STATUS_CHANNEL_ID');
  let messageId = await configRepo.get('SERVER_STATUS_MESSAGE_ID');

  if (!serverId || !channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const status = await getServerStatus(serverId);

  // -----------------------------
  // 🔹 1. ตั้งสถานะบอท (NEW)
  // -----------------------------
  if (status) {
    const text =
      status.status === 'online'
        ? `👥 ${status.players}/${status.maxPlayers} Players`
        : `🔴 Offline`;

    client.user.setPresence({
      activities: [
        {
          name: text,
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
  }

  // -----------------------------
  // 🔹 2. Embed (LOOSE VERSION)
  // -----------------------------
  const embed = {
    color: status?.status === 'online' ? 0x2ecc71 : 0xe74c3c,
    title: '📊 SCUM SERVER STATUS',
    description: status
      ? `**${status.name}**\nข้อมูลห้องนี้อัปเดตอัตโนมัติ`
      : `ไม่สามารถดึงข้อมูลเซิร์ฟได้`,
    fields: status
      ? [
          {
            name: '📡 สถานะ',
            value: status.status === 'online' ? '🟢 ออนไลน์' : '🔴 ออฟไลน์',
          },
          {
            name: '👥 ผู้เล่นออนไลน์',
            value: `${status.players}/${status.maxPlayers}`,
          },
          {
            name: '⏳ คิวรอเข้า',
            value: `${status.details?.queue || 0}`,
          },
          {
            name: '🌐 IP / Port',
            value: status.details?.connect || 'Unknown',
          },
        ]
      : [],
    footer: {
      text: `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`,
    },
  };

  let message;

  if (messageId) {
    message = await channel.messages.fetch(messageId).catch(() => null);
  }

  if (!message) {
    const sent = await channel.send({ embeds: [embed] });
    await configRepo.set('SERVER_STATUS_MESSAGE_ID', sent.id);
  } else {
    await message.edit({ embeds: [embed] });
  }
}

module.exports = {
  runServerStatusJob,
};
