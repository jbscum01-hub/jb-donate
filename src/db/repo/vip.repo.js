import { pool } from "../pool.js";

export const VipRepo = {
  async dueGrants() {
    const { rows } = await pool.query(`select * from vip_subscriptions where active=true and next_grant_at <= now()`);
    return rows;
  },
  async expiring24h() {
    const { rows } = await pool.query(`
      select * from vip_subscriptions
      where active=true and warned_24h=false and expire_at <= now() + interval '24 hours'
    `);
    return rows;
  },
  async expired() {
    const { rows } = await pool.query(`select * from vip_subscriptions where active=true and expire_at <= now()`);
    return rows;
  },
  async bumpGrant(id) {
    await pool.query(`
      update vip_subscriptions
      set last_grant_at=now(), next_grant_at=next_grant_at + interval '7 days', updated_at=now()
      where id=$1
    `, [id]);
  },
  async markWarned(id) {
    await pool.query(`update vip_subscriptions set warned_24h=true, updated_at=now() where id=$1`, [id]);
  },
  async deactivate(id) {
    await pool.query(`update vip_subscriptions set active=false, updated_at=now() where id=$1`, [id]);
  },
};
