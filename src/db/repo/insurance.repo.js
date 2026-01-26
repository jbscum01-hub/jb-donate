import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const InsuranceRepo = {
  async upsertInsurance(i) {
    const { rows } = await pool.query(SQL.upsertVehicleInsurance, [
      i.plate, i.kind, i.total, i.used ?? 0, i.expire_at ?? null, i.order_no ?? null, i.source ?? 'DONATE_PACK'
    ]);
    return rows[0];
  },

  async getInsurance(plate, kind) {
    const { rows } = await pool.query(SQL.getVehicleInsurance, [plate, kind]);
    return rows[0] ?? null;
  },

  async useOnce(plate, kind) {
    const { rows } = await pool.query(SQL.useVehicleInsurance, [plate, kind]);
    return rows[0] ?? null;
  },

  async log(l) {
    await pool.query(SQL.insertInsuranceLog, [
      l.guild_id, l.plate, l.kind, l.action, l.delta, l.order_no ?? null, l.user_id ?? null, l.staff_id ?? null, l.note ?? null
    ]);
  },
};
