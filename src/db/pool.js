import pg from "pg";
import { ENV } from "../config/env.js";

const ssl =
  ENV.DATABASE_URL.includes("sslmode=require") ||
  ENV.DATABASE_URL.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false;

export const pool = new pg.Pool({
  connectionString: ENV.DATABASE_URL,
  ssl,
});
