import pg from "pg";
import { ENV } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: ENV.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
