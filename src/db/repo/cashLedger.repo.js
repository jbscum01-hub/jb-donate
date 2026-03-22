import { pool } from "../pool.js";

function n(v) {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
}

async function tableExists() {
  const { rows } = await pool.query(
    `select exists (
       select 1
       from information_schema.tables
       where table_schema = 'public'
         and table_name = 'tb_donate_cash_ledger'
     ) as ok`
  );
  return Boolean(rows[0]?.ok);
}


async function hasColumn(columnName) {
  const { rows } = await pool.query(
    `select exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'tb_donate_cash_ledger'
         and column_name = $1
     ) as ok`,
    [columnName],
  );
  return Boolean(rows[0]?.ok);
}

export const CashLedgerRepo = {
  async isReady() {
    try {
      return await tableExists();
    } catch {
      return false;
    }
  },

  async getSummary(guildId = null) {
    if (!(await this.isReady())) {
      return { total_in: 0, total_out: 0, current_balance: 0, tx_count: 0, last_tx_at: null, ready: false };
    }

    const values = [];
    const where = [];
    if (guildId) {
      values.push(guildId);
      where.push(`guild_id = $${values.length}`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    const { rows } = await pool.query(
      `select
         coalesce(sum(case when txn_type = 'IN' then amount else 0 end), 0)::bigint as total_in,
         coalesce(sum(case when txn_type = 'OUT' then amount else 0 end), 0)::bigint as total_out,
         coalesce(max(balance_after), 0)::bigint as current_balance,
         count(*)::bigint as tx_count,
         max(created_at) as last_tx_at
       from tb_donate_cash_ledger
       ${whereSql}`,
      values,
    );

    return {
      total_in: n(rows[0]?.total_in),
      total_out: n(rows[0]?.total_out),
      current_balance: n(rows[0]?.current_balance),
      tx_count: n(rows[0]?.tx_count),
      last_tx_at: rows[0]?.last_tx_at || null,
      ready: true,
    };
  },

  async addEntry({ guildId = null, txnType, amount, reason, note = null, imageUrl = null, actorId = null, actorTag = null }) {
    if (!(await this.isReady())) {
      throw new Error("tb_donate_cash_ledger table not found");
    }

    const type = String(txnType || "").trim().toUpperCase();
    if (!["IN", "OUT"].includes(type)) throw new Error("Invalid txn type");

    const amt = Math.trunc(Number(amount || 0));
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("จำนวนเงินต้องมากกว่า 0");

    const cleanReason = String(reason || "").trim();
    if (!cleanReason) throw new Error("กรุณาระบุเหตุผล");

    const client = await pool.connect();
    try {
      await client.query("begin");

      const last = await client.query(
        `select balance_after
         from tb_donate_cash_ledger
         ${guildId ? "where guild_id = $1" : ""}
         order by created_at desc, ledger_id desc
         limit 1`,
        guildId ? [guildId] : [],
      );

      const before = n(last.rows[0]?.balance_after);
      const after = type === "IN" ? before + amt : before - amt;
      if (type === "OUT" && after < 0) {
        throw new Error(`ยอดเงินคงเหลือไม่พอ (คงเหลือ ${before.toLocaleString("en-US")})`);
      }

      const supportsImage = await hasColumn("image_url");
      const ins = supportsImage
        ? await client.query(
            `insert into tb_donate_cash_ledger
             (
               guild_id,
               txn_type,
               amount,
               balance_after,
               reason,
               note,
               image_url,
               actor_id,
               actor_tag
             )
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             returning *`,
            [guildId, type, amt, after, cleanReason, note || null, imageUrl || null, actorId, actorTag],
          )
        : await client.query(
            `insert into tb_donate_cash_ledger
             (
               guild_id,
               txn_type,
               amount,
               balance_after,
               reason,
               note,
               actor_id,
               actor_tag
             )
             values ($1,$2,$3,$4,$5,$6,$7,$8)
             returning *`,
            [guildId, type, amt, after, cleanReason, note || null, actorId, actorTag],
          );

      await client.query("commit");
      return ins.rows[0];
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  },

  async listRecent(guildId = null, limit = 10) {
    if (!(await this.isReady())) return [];

    const supportsImage = await hasColumn("image_url");
    const values = [];
    const where = [];
    if (guildId) {
      values.push(guildId);
      where.push(`guild_id = $${values.length}`);
    }
    values.push(Number(limit) || 10);
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const imageSelect = supportsImage ? "image_url" : "null::text as image_url";

    const { rows } = await pool.query(
      `select ledger_id, guild_id, txn_type, amount, balance_after, reason, note, ${imageSelect}, actor_id, actor_tag, created_at
       from tb_donate_cash_ledger
       ${whereSql}
       order by created_at desc, ledger_id desc
       limit $${values.length}`,
      values,
    );
    return rows;
  },
};
