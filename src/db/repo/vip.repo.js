import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const VipRepo = {
  async getDashboardStats(guildId) {
    const { rows } = await pool.query(
      `select
         count(*) filter (where active=true)::bigint as active,
         count(*) filter (where active=true and expire_at <= now())::bigint as expired,
         count(*) filter (where active=true and expire_at <= now() + interval '24 hours')::bigint as expiring_24h,
         count(*) filter (where active=true and expire_at <= now() + interval '3 days')::bigint as expiring_3d,
         count(*) filter (where active=true and next_grant_at <= now())::bigint as due_grants
       from tb_donate_vip_subscriptions
       where guild_id=$1`,
      [guildId]
    );
    return rows[0] ?? { active: 0, expired: 0, expiring_24h: 0, expiring_3d: 0, due_grants: 0 };
  },

  async listExpiringSoon(guildId, hours = 24, limit = 5) {
    const { rows } = await pool.query(
      `select user_id, vip_code, expire_at
       from tb_donate_vip_subscriptions
       where guild_id=$1
         and active=true
         and expire_at is not null
         and expire_at <= now() + ($2 || ' hours')::interval
       order by expire_at asc
       limit $3`,
      [guildId, Number(hours) || 24, Number(limit) || 5]
    );
    return rows;
  },

  async dueGrants() {
    const { rows } = await pool.query(
      `select * from tb_donate_vip_subscriptions
       where active=true
         and next_grant_at is not null
         and next_grant_at <= now()`
    );
    return rows;
  },

  async expiring24h() {
    const { rows } = await pool.query(
      `select * from tb_donate_vip_subscriptions
       where active=true
         and warned_24h=false
         and expire_at is not null
         and expire_at <= now() + interval '24 hours'`
    );
    return rows;
  },

  async expired() {
    const { rows } = await pool.query(
      `select * from tb_donate_vip_subscriptions
       where active=true
         and expire_at is not null
         and expire_at <= now()`
    );
    return rows;
  },

  async activateOrExtend({ guildId, userId, vipCode, roleId, daysToAdd }) {
    const { rows } = await pool.query(SQL.upsertVipSubscription, [
      guildId,
      userId,
      vipCode,
      roleId,
      Number(daysToAdd) || 999,
    ]);
    return rows[0] ?? null;
  },

  async bumpGrant(id) {
    await pool.query(
      `update tb_donate_vip_subscriptions
       set next_grant_at = coalesce(next_grant_at, now()) + interval '7 days'
       where id=$1`,
      [id]
    );
  },

  async markWarned(id) {
    await pool.query(`update tb_donate_vip_subscriptions set warned_24h=true where id=$1`, [id]);
  },

  async deactivate(id) {
    await pool.query(`update tb_donate_vip_subscriptions set active=false where id=$1`, [id]);
  },
};
