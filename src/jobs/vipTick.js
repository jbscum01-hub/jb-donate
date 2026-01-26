import { createClient } from "../discord/client.js";
import { IDS } from "../config/constants.js";
import { VipRepo } from "../db/repo/vip.repo.js";
import { VIP_PACKS } from "../domain/catalog.js";

const client = createClient();

async function logVip(text) {
  const ch = await client.channels.fetch(IDS.VIP_LOG_CHANNEL_ID);
  await ch.send(text);
}

async function dmUser(userId, text) {
  try {
    const u = await client.users.fetch(userId);
    await u.send(text);
  } catch {}
}

client.once("ready", async () => {
  try {
    // 1) due grants
    const due = await VipRepo.dueGrants();
    for (const v of due) {
      const pack = VIP_PACKS[v.vip_code];
      const items = (pack?.weeklyItems ?? []).map(x => `- ${x}`).join("\n");
      await logVip(`🎁 VIP DUE | ${v.vip_code} | <@${v.user_id}>\nสรุปรายการแจก (ทีมงานแจกเอง):\n${items}`);
      await dmUser(v.user_id, `🎁 ถึงรอบรับของ VIP (${v.vip_code}) แล้ว! ทีมงานกำลังดำเนินการแจกให้ ✅`);
      await VipRepo.bumpGrant(v.id);
    }

    // 2) expiring 24h
    const warn = await VipRepo.expiring24h();
    for (const v of warn) {
      await logVip(`⏳ VIP EXPIRING 24H | ${v.vip_code} | <@${v.user_id}> | expire: ${v.expire_at}`);
      await dmUser(v.user_id, `⏳ VIP (${v.vip_code}) ของคุณจะหมดอายุภายใน 24 ชั่วโมง (หมดอายุ: ${v.expire_at})`);
      await VipRepo.markWarned(v.id);
    }

    // 3) expired
    const expired = await VipRepo.expired();
    for (const v of expired) {
      const guild = await client.guilds.fetch(v.guild_id);
      const member = await guild.members.fetch(v.user_id).catch(()=>null);
      if (member) await member.roles.remove(v.role_id).catch(()=>{});
      await VipRepo.deactivate(v.id);
      await logVip(`🧾 VIP EXPIRED | ${v.vip_code} | <@${v.user_id}> | role removed`);
      await dmUser(v.user_id, `🧾 VIP (${v.vip_code}) หมดอายุแล้ว ระบบได้ถอดยศ VIP อัตโนมัติค่ะ`);
    }
  } finally {
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
