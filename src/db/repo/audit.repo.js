const db = require('../queries');

async function add({
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
    guildId,
    actorId,
    actorTag,
    action,
    target,
    meta ? JSON.stringify(meta) : null,
  ];

  const result = await db.query(sql, values);
  return result.rows[0];
}

module.exports = {
  add,
};
