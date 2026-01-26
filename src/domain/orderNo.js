import { pool } from "../db/pool.js";
import { yyyymmdd } from "./time.js";

export async function nextOrderNo(prefix = "JB") {
  const day = yyyymmdd();
  const like = `${prefix}-${day}-%`;
  const { rows } = await pool.query(`select count(*)::int as c from orders where order_no like $1`, [like]);
  const n = (rows?.[0]?.c ?? 0) + 1;
  return `${prefix}-${day}-${String(n).padStart(4, "0")}`;
}
