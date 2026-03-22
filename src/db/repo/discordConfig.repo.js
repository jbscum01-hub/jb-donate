import { pool } from "../pool.js";

const DEFAULT_SCOPE_TYPE = "GLOBAL";
const DEFAULT_SCOPE_KEY = "SYSTEM";

function normalizeScope(scopeType = DEFAULT_SCOPE_TYPE, scopeKey = DEFAULT_SCOPE_KEY) {
  return {
    scopeType: String(scopeType || DEFAULT_SCOPE_TYPE).trim(),
    scopeKey: String(scopeKey || DEFAULT_SCOPE_KEY).trim(),
  };
}

export const DiscordConfigRepo = {
  DEFAULT_SCOPE_TYPE,
  DEFAULT_SCOPE_KEY,

  async listActive(scopeType = DEFAULT_SCOPE_TYPE, scopeKey = DEFAULT_SCOPE_KEY) {
    const scope = normalizeScope(scopeType, scopeKey);
    const sql = `
      select
        config_id,
        scope_type,
        scope_key,
        config_key,
        config_value,
        display_name,
        is_active,
        created_at,
        updated_at
      from tb_donate_discord_config
      where scope_type = $1
        and scope_key = $2
        and is_active = true
      order by config_key asc
    `;
    const result = await pool.query(sql, [scope.scopeType, scope.scopeKey]);
    return result.rows;
  },

  async get(configKey, scopeType = DEFAULT_SCOPE_TYPE, scopeKey = DEFAULT_SCOPE_KEY) {
    const scope = normalizeScope(scopeType, scopeKey);
    const sql = `
      select
        config_id,
        scope_type,
        scope_key,
        config_key,
        config_value,
        display_name,
        is_active,
        created_at,
        updated_at
      from tb_donate_discord_config
      where scope_type = $1
        and scope_key = $2
        and config_key = $3
      limit 1
    `;
    const result = await pool.query(sql, [scope.scopeType, scope.scopeKey, configKey]);
    return result.rows[0] ?? null;
  },

  async set(configKey, configValue, { displayName = null, isActive = true, scopeType = DEFAULT_SCOPE_TYPE, scopeKey = DEFAULT_SCOPE_KEY } = {}) {
    const scope = normalizeScope(scopeType, scopeKey);
    const sql = `
      insert into tb_donate_discord_config
      (
        scope_type,
        scope_key,
        config_key,
        config_value,
        display_name,
        is_active,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, now())
      on conflict (scope_type, scope_key, config_key)
      do update set
        config_value = excluded.config_value,
        display_name = coalesce(excluded.display_name, tb_donate_discord_config.display_name),
        is_active = excluded.is_active,
        updated_at = now()
      returning
        config_id,
        scope_type,
        scope_key,
        config_key,
        config_value,
        display_name,
        is_active,
        created_at,
        updated_at
    `;

    const result = await pool.query(sql, [
      scope.scopeType,
      scope.scopeKey,
      configKey,
      String(configValue ?? "").trim(),
      displayName,
      Boolean(isActive),
    ]);

    return result.rows[0] ?? null;
  },
};
