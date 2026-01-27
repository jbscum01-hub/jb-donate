// src/db/repo/orders.repo.js
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

  async setSelection(orderNo, vehicle, boat) {
    const { rows } = await pool.query(SQL.setOrderSelection, [orderNo, vehicle ?? null, boat ?? null]);
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

  async setQueueMessageId(orderNo, messageId) {
    await pool.query(SQL.setOrderQueueMsg, [orderNo, messageId]);
  },
};
