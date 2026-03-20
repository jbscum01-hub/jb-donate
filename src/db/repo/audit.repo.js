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
      insert into tb_donate_audit_logs
      (
        guild_id,
        actor_id,
        actor_tag,
        action,
        target,
        meta
      )
      values ($1, $2, $3, $4, $5, $6)
      returning id
    `;

    const values = [
      guildId ?? null,
      actorId,
      actorTag,
      action,
      target,
      meta ?? null,
    ];

    const result = await pool.query(sql, values);
    return result.rows[0] ?? null;
  },
};
