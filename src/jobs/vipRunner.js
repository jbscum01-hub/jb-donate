// src/jobs/vipRunner.js
import { IDS } from "../config/constants.js";
import { VipRepo } from "../db/repo/vip.repo.js";
import { VIP_PACKS } from "../domain/catalog.js";

async function logVip(client, text) {
  const ch = await client.channels.fetch(IDS.VIP_LOG_CHANNEL_ID);
  await ch.send(text);
}

async function dmUser(client, userId, text) {
  try {
    const u = await client.users.fetch(userId);
    await u.send(text);
  } catch {}
}

/**
 * Run VIP maintenance:
 * - Due grants (every 7 days, checked by next_grant_at)
 * - 24h expiry warnings
 * - Expired role removals
 */
export async function runVipTick(client) {
  // 1) due grants
  const due = await VipRepo.dueGrants();
  for (const v of due) {
    const pack = VIP_PACKS[v.vip_code];
    const items = (pack?.displayItems ?? []).map(x => `- ${x}`).join("
");
    const cmds = (pack?.spawnItems ?? []).join("
");
    await logVip(
      client,
      `🎁 VIP DUE | ${v.vip_code} | <@${v.user_id}>\nสรุปรายการแจก (ทีมงานแจกเอง):\n${items}`
    );
    await dmUser(client, v.user_id, `🎁 ถึงรอบรับของ VIP (${v.vip_code}) แล้ว! ทีมงานกำลังดำเนินการแจกให้ ✅`);
    await VipRepo.bumpGrant(v.id);
  }

  // 2) expiring 24h
  const warn = await VipRepo.expiring24h();
  for (const v of warn) {
    await logVip(client, `⏳ VIP EXPIRING 24H | ${v.vip_code} | <@${v.user_id}> | expire: ${v.expire_at}`);
    await dmUser(client, v.user_id, `⏳ VIP (${v.vip_code}) ของคุณจะหมดอายุภายใน 24 ชั่วโมง (หมดอายุ: ${v.expire_at})`);
    await VipRepo.markWarned(v.id);
  }

  // 3) expired
  const expired = await VipRepo.expired();
  for (const v of expired) {
    const guild = await client.guilds.fetch(v.guild_id);
    const member = await guild.members.fetch(v.user_id).catch(() => null);
    if (member) await member.roles.remove(v.role_id).catch(() => {});
    await VipRepo.deactivate(v.id);
    await logVip(client, `🧾 VIP EXPIRED | ${v.vip_code} | <@${v.user_id}> | role removed`);
    await dmUser(client, v.user_id, `🧾 VIP (${v.vip_code}) หมดอายุแล้ว ระบบได้ถอดยศ VIP อัตโนมัติค่ะ`);
  }

  return { due: due.length, warn: warn.length, expired: expired.length };
}
