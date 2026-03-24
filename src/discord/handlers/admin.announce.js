import { isAdmin } from '../../domain/permissions.js';
import { AuditRepo } from '../../db/repo/audit.repo.js';
import { getAnnounceRuntime, sendRconAnnouncement } from '../../services/rconAnnounce.service.js';

export async function handleAdminAnnounceMessage(message) {
  if (!message || message.author?.bot || !message.guild) return false;

  const runtime = getAnnounceRuntime();
  const prefix = runtime.adminPrefix;
  if (!runtime.adminCommandEnabled || !prefix) return false;

  const content = String(message.content || '').trim();
  if (!content.toLowerCase().startsWith(prefix.toLowerCase())) return false;

  if (!isAdmin(message.member)) {
    await message.reply('❌ คำสั่งนี้ใช้ได้เฉพาะแอดมิน').catch(() => {});
    return true;
  }

  const rawText = content.slice(prefix.length).trim();
  if (!rawText) {
    await message.reply(`⚠️ วิธีใช้: ${prefix} <ข้อความประกาศ>`).catch(() => {});
    return true;
  }

  const result = await sendRconAnnouncement(rawText, { source: 'admin_command' });

  await AuditRepo.add({
    guildId: message.guildId,
    actorId: message.author.id,
    actorTag: message.author.tag ?? message.author.username,
    action: 'ANNOUNCE_ADMIN_SEND',
    target: 'SCUM_RCON',
    meta: {
      ok: result.ok,
      skipped: Boolean(result.skipped),
      reason: result.reason ?? null,
      message: rawText,
      channel_id: message.channelId,
    },
  }).catch(() => {});

  if (result.ok) {
    const replyText = runtime.echoToChannel
      ? `✅ ส่งประกาศเข้าเกมแล้ว\n> ${rawText}`
      : '✅ ส่งประกาศเข้าเกมแล้ว';
    await message.reply(replyText).catch(() => {});
    return true;
  }

  const reason = result.reason ? ` (${result.reason})` : '';
  await message.reply(`❌ ส่งประกาศไม่สำเร็จ${reason}`).catch(() => {});
  return true;
}
