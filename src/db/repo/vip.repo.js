import { pool } from "../pool.js";
import { SQL } from "../queries.js";

/**
 * vip_subscriptions schema (per your Supabase table):
 * - id serial pk
 * - guild_id varchar(32)
 * - user_id varchar(32)
 * - vip_code varchar(50)
 * - role_id varchar(32)
 * - active boolean default true
 * - next_grant_at timestamp
 * - expire_at timestamp
 * - warned_24h boolean default false
 * - created_at timestamp default now()
 */
export const VipRepo = {
  async dueGrants() {
    const { rows } = await pool.query(
      `select * from vip_subscriptions
       where active=true
         and next_grant_at is not null
         and next_grant_at <= now()`
    );
    return rows;
  },

  async expiring24h() {
    const { rows } = await pool.query(
      `select * from vip_subscriptions
       where active=true
         and warned_24h=false
         and expire_at is not null
         and expire_at <= now() + interval '24 hours'`
    );
    return rows;
  },

  async expired() {
    const { rows } = await pool.query(
      `select * from vip_subscriptions
       where active=true
         and expire_at is not null
         and expire_at <= now()`
    );
    return rows;
  },

  /**
   * Create or extend VIP subscription.
   * - Extend expire_at from max(expire_at, now()) by daysToAdd
   * - Ensure next_grant_at is set (coalesce to now())
   * - Reset warned_24h=false
   */
  async activateOrExtend({ guildId, userId, vipCode, roleId, daysToAdd }) {
    const { rows } = await pool.query(SQL.upsertVipSubscription, [
      guildId,
      userId,
      vipCode,
      roleId,
      Number(daysToAdd) || 30,
    ]);
    return rows[0] ?? null;
  },

  /**
   * After a weekly grant, push next_grant_at by 7 days.
   */
  async bumpGrant(id) {
    await pool.query(
      `update vip_subscriptions
       set next_grant_at = coalesce(next_grant_at, now()) + interval '7 days'
       where id=$1`,
      [id]
    );
  },

  async markWarned(id) {
    await pool.query(
      `update vip_subscriptions set warned_24h=true where id=$1`,
      [id]
    );
  },

  async deactivate(id) {
    await pool.query(
      `update vip_subscriptions set active=false where id=$1`,
      [id]
    );
  },
};
