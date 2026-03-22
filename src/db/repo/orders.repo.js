import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const OrdersRepo = {
  async insert(order) {
    const { rows } = await pool.query(SQL.insertOrder, [
      order.order_no,
      order.guild_id,
      order.user_id,
      order.user_tag,
      order.type,
      order.pack_id ?? null,
      order.pack_code,
      order.amount,
      order.ign,
      order.steam_id,
      order.note ?? null,
      order.ticket_channel_id ?? null,
    ]);
    return rows[0];
  },

  async getByNo(orderNo) {
    const { rows } = await pool.query(SQL.getOrderByNo, [orderNo]);
    return rows[0] ?? null;
  },

  async findOpenByUser(guildId, userId) {
    const { rows } = await pool.query(SQL.findOpenOrderByUser, [guildId, userId]);
    return rows[0] ?? null;
  },

  async setStatus(orderNo, status, staffId) {
    const { rows } = await pool.query(SQL.setOrderStatus, [orderNo, status, staffId]);
    return rows[0] ?? null;
  },

  async setCarPlate(orderNo, plate, staffId) {
    const { rows } = await pool.query(SQL.setOrderCarPlate, [orderNo, plate, staffId]);
    return rows[0] ?? null;
  },

  async setBoatPlate(orderNo, plate, staffId) {
    const { rows } = await pool.query(SQL.setOrderBoatPlate, [orderNo, plate, staffId]);
    return rows[0] ?? null;
  },

  async setPlate(orderNo, plate, staffId) {
    const { rows } = await pool.query(SQL.setOrderPlate, [orderNo, plate, staffId]);
    return rows[0] ?? null;
  },

  async setSelection(orderNo, vehicle, boat) {
    const { rows } = await pool.query(SQL.setOrderSelection, [orderNo, vehicle ?? null, boat ?? null]);
    return rows[0] ?? null;
  },

  async setQueueMessageId(orderNo, messageId) {
    await pool.query(SQL.setOrderQueueMsg, [orderNo, messageId]);
  },

  async getOpenQueueCount(guildId) {
    const { rows } = await pool.query(SQL.getOpenQueueCount, [guildId]);
    return Number(rows[0]?.queue_count ?? 0);
  },

  async getDashboardStats(guildId) {
    const { rows } = await pool.query(SQL.getOrdersDashboardStats, [guildId]);
    return rows[0] ?? {
      total_amount: 0,
      total_orders: 0,
      today_amount: 0,
      today_orders: 0,
      pending_orders: 0,
      approved_orders: 0,
      success_orders: 0,
      cancelled_orders: 0,
    };
  },

  async getDashboardExtra(guildId) {
    const { rows } = await pool.query(SQL.getOrdersDashboardExtra, [guildId]);
    return rows[0] ?? {
      today_pending: 0,
      today_approved: 0,
      today_success: 0,
      today_cancelled: 0,
      today_donate_amount: 0,
      today_donate_orders: 0,
      today_vip_amount: 0,
      today_vip_orders: 0,
      today_boost_amount: 0,
      today_boost_orders: 0,
      pending_over_24h: 0,
      oldest_pending_th: null,
    };
  },

  async getRecent(guildId, limit = 5) {
    const { rows } = await pool.query(SQL.getOrdersRecent, [guildId, Number(limit) || 5]);
    return rows;
  },



  async getWindowStats(guildId) {
    const { rows } = await pool.query(
      `with base as (
         select o.*,
                (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') as created_th
         from tb_donate_orders o
         where o.guild_id = $1
           and o.status = 'SUCCESS'
       )
       select
         coalesce(sum(case when created_at >= now() - interval '7 days' then amount else 0 end), 0)::bigint as amount_7d,
         count(case when created_at >= now() - interval '7 days' then 1 end)::bigint as orders_7d,
         coalesce(sum(case when created_at >= now() - interval '30 days' then amount else 0 end), 0)::bigint as amount_30d,
         count(case when created_at >= now() - interval '30 days' then 1 end)::bigint as orders_30d,
         coalesce(avg(amount), 0)::numeric(18,2) as avg_order_amount,
         max(created_th) as last_success_th
       from base`,
      [guildId],
    );
    return rows[0] ?? {
      amount_7d: 0,
      orders_7d: 0,
      amount_30d: 0,
      orders_30d: 0,
      avg_order_amount: 0,
      last_success_th: null,
    };
  },

  async getTopPacks7d(guildId, limit = 5) {
    const { rows } = await pool.query(SQL.getOrdersTopPacks7d, [guildId, Number(limit) || 5]);
    return rows;
  },

  async adminSearch(keyword, guildId = null, mode = "AUTO", limit = 6) {
    const q = String(keyword || "").trim();
    const upper = q.toUpperCase();
    const values = [];
    const where = [];

    if (guildId) {
      values.push(guildId);
      where.push(`guild_id = $${values.length}`);
    }

    if (!q) return [];

    const exactOrder = mode === "ORDER" || /^ORD[-_]?/i.test(q) || /^DN/i.test(q) || /^VIP/i.test(q) || /^BST/i.test(q);
    const exactUser = mode === "USER" || /^\d{15,25}$/.test(q);
    const exactPlate = mode === "PLATE";
    const exactPack = mode === "PACK";

    const or = [];

    values.push(q);
    const exactParam = `$${values.length}`;
    values.push(`%${q}%`);
    const likeParam = `$${values.length}`;
    values.push(`%${upper}%`);
    const upperLikeParam = `$${values.length}`;

    if (exactOrder || mode === "AUTO") or.push(`order_no = ${exactParam}`);
    if (exactUser || mode === "AUTO") or.push(`user_id = ${exactParam}`);
    if (exactPack || mode === "AUTO") or.push(`upper(pack_code) like ${upperLikeParam}`);
    if (exactPlate || mode === "AUTO") {
      or.push(`upper(coalesce(plate,'')) like ${upperLikeParam}`);
      or.push(`upper(coalesce(car_plate,'')) like ${upperLikeParam}`);
      or.push(`upper(coalesce(boat_plate,'')) like ${upperLikeParam}`);
    }
    if (mode === "AUTO" || mode === "USER") {
      or.push(`coalesce(user_tag,'') ilike ${likeParam}`);
      or.push(`coalesce(ign,'') ilike ${likeParam}`);
    }
    if (mode === "AUTO") {
      or.push(`coalesce(ticket_channel_id,'') = ${exactParam}`);
      or.push(`coalesce(note,'') ilike ${likeParam}`);
    }

    where.push(`(${or.join(" or ")})`);
    values.push(Number(limit) || 6);

    const { rows } = await pool.query(
      `select *
       from tb_donate_orders
       where ${where.join(" and ")}
       order by created_at desc
       limit $${values.length}`,
      values,
    );

    return rows;
  },
};
