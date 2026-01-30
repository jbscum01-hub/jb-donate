import { pool } from "../pool.js";

/**
 * vip_subscriptions schema (as in Supabase UI):
 * - id (serial pk)
 * - guild_id varchar
 * - user_id varchar
 * - vip_code varchar
 * - role_id varchar
 * - active boolean default true
 * - next_grant_at timestamp
 * - expire_at timestamp
 * - warned_24h boolean default false
 * - created_at timestamp default now()
 *
 * NOTE: table may NOT have updated_at / last_grant_at. Do not reference them.
 */
export const VipRepo = {
  async getActiveByUserCode(guildId, userId, vipCode) {
    const { rows } = await pool.query(
      `select * from vip_subscriptions
       where guild_id=$1 and user_id=$2 and vip_code=$3 and active=true
       order by id desc
       limit 1`,
      [guildId, userId, vipCode]
    );
    return rows[0] ?? null;
  },

  /**
   * Create or extend VIP subscription.
   * - If existing active row found: extend expire_at from max(expire_at, now()) by daysToAdd
   * - Keep next_grant_at if exists; if NULL, set now() (so next tick can grant)
   * - Reset warned_24h=false and ensure active=true, role_id updated
   *
   * Returns the subscription row after upsert-like behavior.
   */
  async activateOrExtend({ guildId, userId, vipCode, roleId, daysToAdd }) {
    const existing = await this.getActiveByUserCode(guildId, userId, vipCode);

    if (!existing) {
      const { rows } = await pool.query(
        `insert into vip_subscriptions
          (guild_id, user_id, vip_code, role_id, active, next_grant_at, expire_at, warned_24h)
         values
          ($1,$2,$3,$4,true, now(), now() + ($5 || ' days')::interval, false)
         returning *`,
        [guildId, userId, vipCode, roleId, String(daysToAdd)]
      );
      return rows[0];
    }

    const { rows } = await pool.query(
      `update vip_subscriptions
       set
         role_id = $4,
         active = true,
         warned_24h = false,
         next_grant_at = coalesce(next_grant_at, now()),
         expire_at = greatest(coalesce(expire_at, now()), now()) + ($5 || ' days')::interval
       where id=$1
       returning *`,
      [existing.id, guildId, userId, roleId, String(daysToAdd)]
    );
    return rows[0] ?? existing;
  },

  // --- Tick queries ---
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

  async bumpGrant(id) {
    await pool.query(
      `update vip_subscriptions
       set next_grant_at = greatest(coalesce(next_grant_at, now()), now()) + interval '7 days'
       where id=$1`,
      [id]
    );
  },

  async markWarned(id) {
    await pool.query(
      `update vip_subscriptions
       set warned_24h=true
       where id=$1`,
      [id]
    );
  },

  async deactivate(id) {
    await pool.query(
      `update vip_subscriptions
       set active=false
       where id=$1`,
      [id]
    );
  },
};
