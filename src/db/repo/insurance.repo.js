// src/db/repo/insurance.repo.js
import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const InsuranceRepo = {
  /**
   * Upsert insurance by ACCUMULATING totals and EXTENDING expiry.
   * Required fields:
   * - plate: string
   * - kind: 'CAR' | 'BOAT'
   * - add_total: number  (how many to add)
   * - days: number       (how many days to extend; MUST be > 0 for insurance packs)
   *
   * Optional:
   * - order_no, source
   *
   * Note: used is NOT overwritten on updates.
   */
  async upsertInsurance(i) {
    const addTotal = Number(i.add_total ?? i.total ?? 0);
    const days = Number(i.days ?? 0);

    const { rows } = await pool.query(SQL.upsertVehicleInsurance, [
      i.plate,
      i.kind,
      addTotal,
      0,                 // used initial (only used on first insert)
      days,              // days_to_add (controls expire_at)
      i.order_no ?? null,
      i.source ?? "DONATE_PACK",
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
      l.guild_id,
      l.plate,
      l.kind,
      l.action,
      l.delta,
      l.order_no ?? null,
      l.user_id ?? null,
      l.staff_id ?? null,
      l.note ?? null,
    ]);
  },
};
