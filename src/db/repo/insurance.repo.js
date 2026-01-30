// src/db/repo/insurance.repo.js
import { pool } from "../pool.js";
import { SQL } from "../queries.js";

export const InsuranceRepo = {
  async getDashboardStats(limit = 5) {
    const { rows: r1 } = await pool.query(
      `select
         count(*) filter (where expire_at > now())::bigint as active,
         count(*) filter (where expire_at <= now())::bigint as expired,
         count(*) filter (where expire_at <= now() + interval '24 hours')::bigint as expiring_24h,
         count(*) filter (where expire_at <= now() + interval '3 days')::bigint as expiring_3d,
         count(*) filter (where expire_at > now() and used >= total)::bigint as exhausted
       from vehicle_insurance`
    );

    const { rows: soon } = await pool.query(
      `select plate, kind, used, total, expire_at
       from vehicle_insurance
       where expire_at is not null
         and expire_at > now()
       order by expire_at asc
       limit $1`,
      [Number(limit) || 5]
    );

    return { ...(r1[0] ?? { active: 0, expired: 0, expiring_24h: 0, expiring_3d: 0, exhausted: 0 }), soon };
  },
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
