import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const VehiclesRepo = {
  async upsert(v) {
    const { rows } = await pool.query(SQL.upsertVehicle, [
      v.guild_id, v.plate, v.kind, v.model, v.owner_user_id, v.owner_tag, v.order_no ?? null, v.registered_by ?? null
    ]);
    return rows[0];
  },

  async getByPlate(plate) {
    const { rows } = await pool.query(SQL.getVehicleByPlate, [plate]);
    return rows[0] ?? null;
  },

  async setCardMessageId(plate, messageId) {
    const { rows } = await pool.query(SQL.setVehicleCardMessageId, [plate, messageId]);
    return rows[0] ?? null;
  },
};
