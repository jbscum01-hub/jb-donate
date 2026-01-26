import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const AuditRepo = {
  async add(a) {
    await pool.query(SQL.insertAudit, [
      a.guild_id, a.actor_id ?? null, a.actor_tag ?? null, a.action, a.target ?? null, a.meta ?? null
    ]);
  }
};
