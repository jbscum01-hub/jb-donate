import { pool } from "../pool.js";

function parseMeta(meta) {
  if (meta == null) return null;
  if (typeof meta === "object") return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return meta;
  }
}

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

  async listRecent(limit = 12) {
    const { rows } = await pool.query(
      `select id, guild_id, actor_id, actor_tag, action, target, meta, created_at
       from tb_donate_audit_logs
       order by created_at desc
       limit $1`,
      [Number(limit) || 12]
    );
    return rows.map((r) => ({ ...r, meta: parseMeta(r.meta) }));
  },

  async listByActionPrefixes(prefixes = [], limit = 12) {
    const clean = (Array.isArray(prefixes) ? prefixes : [prefixes])
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    if (!clean.length) return this.listRecent(limit);

    const clauses = clean.map((_, i) => `action like $${i + 1}`).join(" or ");
    const values = clean.map((p) => `${p}%`);
    values.push(Number(limit) || 12);

    const { rows } = await pool.query(
      `select id, guild_id, actor_id, actor_tag, action, target, meta, created_at
       from tb_donate_audit_logs
       where ${clauses}
       order by created_at desc
       limit $${clean.length + 1}`,
      values
    );

    return rows.map((r) => ({ ...r, meta: parseMeta(r.meta) }));
  },

  async listByTarget(target, limit = 12) {
    const { rows } = await pool.query(
      `select id, guild_id, actor_id, actor_tag, action, target, meta, created_at
       from tb_donate_audit_logs
       where target = $1
       order by created_at desc
       limit $2`,
      [target, Number(limit) || 12]
    );
    return rows.map((r) => ({ ...r, meta: parseMeta(r.meta) }));
  },
};
