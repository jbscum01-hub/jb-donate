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
       from tb_donate_vehicle_insurance`
    );

    const { rows: soon } = await pool.query(
      `select plate, kind, used, total, expire_at
       from tb_donate_vehicle_insurance
       where expire_at is not null
         and expire_at > now()
       order by expire_at asc
       limit $1`,
      [Number(limit) || 5]
    );

    return { ...(r1[0] ?? { active: 0, expired: 0, expiring_24h: 0, expiring_3d: 0, exhausted: 0 }), soon };
  },

  async upsertInsurance(i) {
    const addTotal = Number(i.add_total ?? i.total ?? 0);
    const days = Number(i.days ?? 0);

    const { rows } = await pool.query(SQL.upsertVehicleInsurance, [
      i.plate,
      i.kind,
      addTotal,
      0,
      days,
      i.order_no ?? null,
      i.source ?? "DONATE_PACK",
    ]);

    return rows[0];
  },

  async getInsurance(plate, kind) {
    const { rows } = await pool.query(SQL.getVehicleInsurance, [plate, kind]);
    return rows[0] ?? null;
  },


  async getInsuranceByPlate(plate) {
    const { rows } = await pool.query(`select * from tb_donate_vehicle_insurance where plate=$1 order by updated_at desc nulls last, created_at desc nulls last limit 1`, [plate]);
    return rows[0] ?? null;
  },

  async listByPlate(plate) {
    const { rows } = await pool.query(`select * from tb_donate_vehicle_insurance where plate=$1 order by updated_at desc nulls last, created_at desc nulls last`, [plate]);
    return rows;
  },

  async cancelInsurance(plate, kind) {
    const { rows } = await pool.query(
      `update tb_donate_vehicle_insurance
       set expire_at = now(),
           updated_at = now()
       where plate=$1 and kind=$2
       returning *`,
      [plate, kind]
    );
    return rows[0] ?? null;
  },

  async listLogsByPlate(plate, kind = null, limit = 10) {
    const params = [plate];
    let sql = `
      select *
      from tb_donate_insurance_logs
      where plate=$1
    `;

    if (kind) {
      params.push(kind);
      sql += ` and kind=$2`;
    }

    params.push(Number(limit) || 10);
    sql += ` order by created_at desc, id desc limit $${params.length}`;

    const { rows } = await pool.query(sql, params);
    return rows;
  },

  async listRecentLogs(limit = 12) {
    const { rows } = await pool.query(
      `select * from tb_donate_insurance_logs order by created_at desc, id desc limit $1`,
      [Number(limit) || 12]
    );
    return rows;
  },

  async useOnce(plate, kind) {
    const { rows } = await pool.query(SQL.useVehicleInsurance, [plate, kind]);
    return rows[0] ?? null;
  },

  async log(l) {
    await pool.query(SQL.insertInsuranceLog, [
      l.guild_id ?? l.guildId ?? null,
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
