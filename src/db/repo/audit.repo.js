import { pool } from "../pool.js";

export const AuditRepo = {
  async add({
    guildId,
    actorId = null,
    actorTag = null,
    action,
    target = null,
    meta = null,
  }) {
    const sql = `
      INSERT INTO audit_logs
      (
        guild_id,
        actor_id,
        actor_tag,
        action,
        target,
        meta
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const values = [
      guildId ?? null,
      actorId,
      actorTag,
      action,
      target,
      meta ? JSON.stringify(meta) : null,
    ];

    const result = await pool.query(sql, values);
    return result.rows[0] ?? null;
  },
};
