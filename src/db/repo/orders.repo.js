import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const OrdersRepo = {
  async insert(order) {
    const { rows } = await pool.query(SQL.insertOrder, [
      order.order_no, order.guild_id, order.user_id, order.user_tag,
      order.type, order.pack_code, order.amount,
      order.ign, order.steam_id, order.note ?? null,
      order.ticket_channel_id ?? null,
    ]);
    return rows[0];
  },

  async getByNo(orderNo) {
    const { rows } = await pool.query(SQL.getOrderByNo, [orderNo]);
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

  async getDashboardStats(guildId) {
  const { rows } = await pool.query(SQL.getOrdersDashboardStats, [guildId]);
  return rows[0] ?? {
    total_amount: 0,
    total_orders: 0,
    today_amount: 0,
    today_orders: 0,
    pending_orders: 0,
    approved_orders: 0,
    delivered_orders: 0,
    closed_orders: 0,
    canceled_orders: 0,
    };
  },

  async getDashboardExtra(guildId) {
    const { rows } = await pool.query(SQL.getOrdersDashboardExtra, [guildId]);
    return rows[0] ?? {
      today_pending: 0,
      today_approved: 0,
      today_delivered: 0,
      today_closed: 0,
      today_canceled: 0,
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

  async getTopPacks7d(guildId, limit = 5) {
    const { rows } = await pool.query(SQL.getOrdersTopPacks7d, [guildId, Number(limit) || 5]);
    return rows;
  },

};
