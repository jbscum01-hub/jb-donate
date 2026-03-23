import { pool } from "../pool.js";

export const ShopPanelRepo = {
  async listByChannel(channelId) {
    const { rows } = await pool.query(
      `select
         panel_id,
         channel_id,
         panel_key,
         pack_id,
         pack_code,
         message_id,
         sort_order,
         is_active,
         created_at,
         updated_at
       from tb_donate_shop_panel_map
       where channel_id = $1
       order by sort_order asc, panel_key asc`,
      [String(channelId)]
    );
    return rows;
  },

  async upsert({ channelId, panelKey, packId = null, packCode = null, messageId, sortOrder = 0, isActive = true }) {
    const { rows } = await pool.query(
      `insert into tb_donate_shop_panel_map
       (
         channel_id,
         panel_key,
         pack_id,
         pack_code,
         message_id,
         sort_order,
         is_active,
         updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, now())
       on conflict (channel_id, panel_key)
       do update set
         pack_id = excluded.pack_id,
         pack_code = excluded.pack_code,
         message_id = excluded.message_id,
         sort_order = excluded.sort_order,
         is_active = excluded.is_active,
         updated_at = now()
       returning
         panel_id,
         channel_id,
         panel_key,
         pack_id,
         pack_code,
         message_id,
         sort_order,
         is_active,
         created_at,
         updated_at`,
      [
        String(channelId),
        String(panelKey),
        packId,
        packCode,
        String(messageId),
        Number(sortOrder || 0),
        Boolean(isActive),
      ]
    );
    return rows[0] ?? null;
  },

  async deactivateMissing(channelId, activePanelKeys = []) {
    const keys = Array.isArray(activePanelKeys) ? activePanelKeys.map((x) => String(x)) : [];
    const { rows } = await pool.query(
      `update tb_donate_shop_panel_map
       set is_active = false,
           updated_at = now()
       where channel_id = $1
         and not (panel_key = any($2::text[]))
       returning
         panel_id,
         channel_id,
         panel_key,
         pack_id,
         pack_code,
         message_id,
         sort_order,
         is_active,
         created_at,
         updated_at`,
      [String(channelId), keys.length ? keys : ["__NO_ACTIVE_PANELS__"]]
    );
    return rows;
  },
};
