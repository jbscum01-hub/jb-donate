import { pool } from "../pool.js";

function normalizeSummary(pack, items = [], vehicles = [], boats = []) {
  if (pack.panel_summary && String(pack.panel_summary).trim()) {
    return String(pack.panel_summary).trim();
  }

  const parts = [];

  const firstItems = items
    .slice(0, 2)
    .map((x) => `${x.item_name}${Number(x.quantity) > 1 ? ` x${x.quantity}` : ""}`);

  if (firstItems.length) {
    parts.push(firstItems.join(" + "));
  }

  if (vehicles.length) {
    const carText = vehicles.length === 1 ? "รถ 1 คัน" : `เลือกรถ ${vehicles.length} แบบ`;
    const ins =
      Number(pack.car_insurance_total || 0) > 0
        ? ` + ประกัน ${Number(pack.car_insurance_total)} ครั้ง`
        : "";
    parts.push(`${carText}${ins}`);
  }

  if (boats.length) {
    const boatText = boats.length === 1 ? "เรือ 1 คัน" : `เลือกเรือ ${boats.length} แบบ`;
    const ins =
      Number(pack.boat_insurance_total || 0) > 0
        ? ` + ประกัน ${Number(pack.boat_insurance_total)} ครั้ง`
        : "";
    parts.push(`${boatText}${ins}`);
  }

  return parts.join("\n") || "กดเลือกแพ็กเพื่อดูรายละเอียดเต็ม";
}

function normalizePackType(v) {
  const allowed = new Set(["DONATE", "VIP", "BOOST", "EVENT"]);
  const s = String(v || "DONATE").trim().toUpperCase();
  return allowed.has(s) ? s : "DONATE";
}

function normalizeText(v, fallback = "") {
  const s = String(v ?? fallback).trim();
  return s;
}

function normalizeNullableText(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function normalizeInt(v, fallback = 0) {
  const n = Number(String(v ?? fallback).trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export const DonatePackRepo = {
  async listActiveShopOptions() {
    const { rows: packs } = await pool.query(
      `select
         pack_id,
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         panel_summary,
         sort_order,
         embed_color,
         allow_vehicle_select,
         allow_boat_select,
         car_insurance_total,
         car_insurance_days,
         boat_insurance_total,
         boat_insurance_days
       from tb_donate_pack_master
       where is_active = true
       order by sort_order asc, pack_code asc`
    );

    if (!packs.length) return [];

    const packIds = packs.map((x) => x.pack_id);

    const [{ rows: itemRows }, { rows: vehicleRows }, { rows: boatRows }] =
      await Promise.all([
        pool.query(
          `select pack_id, item_name, quantity, sort_order, pack_item_id
           from tb_donate_pack_master_item
           where pack_id = any($1::uuid[]) and is_active = true
           order by pack_id asc, sort_order asc, pack_item_id asc`,
          [packIds]
        ),
        pool.query(
          `select pack_id, vehicle_name, insurance_total, insurance_days, sort_order, pack_vehicle_id
           from tb_donate_pack_master_vehicle
           where pack_id = any($1::uuid[]) and is_active = true
           order by pack_id asc, sort_order asc, pack_vehicle_id asc`,
          [packIds]
        ),
        pool.query(
          `select pack_id, boat_name, insurance_total, insurance_days, sort_order, pack_boat_id
           from tb_donate_pack_master_boat
           where pack_id = any($1::uuid[]) and is_active = true
           order by pack_id asc, sort_order asc, pack_boat_id asc`,
          [packIds]
        ),
      ]);

    const itemMap = new Map();
    const vehicleMap = new Map();
    const boatMap = new Map();

    for (const row of itemRows) {
      if (!itemMap.has(row.pack_id)) itemMap.set(row.pack_id, []);
      itemMap.get(row.pack_id).push(row);
    }

    for (const row of vehicleRows) {
      if (!vehicleMap.has(row.pack_id)) vehicleMap.set(row.pack_id, []);
      vehicleMap.get(row.pack_id).push(row);
    }

    for (const row of boatRows) {
      if (!boatMap.has(row.pack_id)) boatMap.set(row.pack_id, []);
      boatMap.get(row.pack_id).push(row);
    }

    return packs.map((pack) => {
      const items = itemMap.get(pack.pack_id) ?? [];
      const vehicles = vehicleMap.get(pack.pack_id) ?? [];
      const boats = boatMap.get(pack.pack_id) ?? [];

      return {
        ...pack,
        summary_lines: normalizeSummary(pack, items, vehicles, boats)
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      };
    });
  },

  async listAdminPacks(limit = 25) {
    const { rows } = await pool.query(
      `select
         pack_id,
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         panel_summary,
         sort_order,
         is_active,
         allow_vehicle_select,
         allow_boat_select,
         car_insurance_total,
         car_insurance_days,
         boat_insurance_total,
         boat_insurance_days,
         vip_code,
         vip_days,
         discord_role_id,
         discord_role_name,
         created_at,
         updated_at,
         created_by,
         updated_by
       from tb_donate_pack_master
       order by sort_order asc, pack_code asc
       limit $1`,
      [limit]
    );
    return rows;
  },

  async getPackById(packId) {
    const { rows } = await pool.query(
      `select
         pack_id,
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         panel_summary,
         sort_order,
         is_active,
         allow_vehicle_select,
         allow_boat_select,
         car_insurance_total,
         car_insurance_days,
         boat_insurance_total,
         boat_insurance_days,
         vip_code,
         vip_days,
         discord_role_id,
         discord_role_name,
         image_url,
         embed_color,
         created_at,
         updated_at,
         created_by,
         updated_by
       from tb_donate_pack_master
       where pack_id = $1
       limit 1`,
      [packId]
    );
    return rows[0] ?? null;
  },

  async getPackByCode(packCode) {
    const { rows } = await pool.query(
      `select
         pack_id,
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         panel_summary,
         sort_order,
         embed_color,
         image_url,
         allow_vehicle_select,
         allow_boat_select,
         car_insurance_total,
         car_insurance_days,
         boat_insurance_total,
         boat_insurance_days,
         vip_code,
         vip_days,
         discord_role_id,
         discord_role_name,
         is_active
       from tb_donate_pack_master
       where pack_code = $1
       limit 1`,
      [packCode]
    );

    return rows[0] ?? null;
  },

  async createPack({
    pack_code,
    pack_name,
    pack_type = "DONATE",
    price = 0,
    description = null,
    panel_summary = null,
    sort_order = 0,
    created_by = null,
    updated_by = null,
  }) {
    const payload = {
      pack_code: normalizeText(pack_code).toUpperCase(),
      pack_name: normalizeText(pack_name),
      pack_type: normalizePackType(pack_type),
      price: normalizeInt(price, 0),
      description: normalizeNullableText(description),
      panel_summary: normalizeNullableText(panel_summary),
      sort_order: normalizeInt(sort_order, 0),
      created_by: normalizeNullableText(created_by),
      updated_by: normalizeNullableText(updated_by),
    };

    const { rows } = await pool.query(
      `insert into tb_donate_pack_master
       (
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         panel_summary,
         sort_order,
         created_by,
         updated_by
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [
        payload.pack_code,
        payload.pack_name,
        payload.pack_type,
        payload.price,
        payload.description,
        payload.panel_summary,
        payload.sort_order,
        payload.created_by,
        payload.updated_by,
      ]
    );

    return rows[0] ?? null;
  },

  async updatePack(packId, patch = {}) {
    const current = await this.getPackById(packId);
    if (!current) return null;

    const next = {
      pack_code: normalizeText(patch.pack_code ?? current.pack_code).toUpperCase(),
      pack_name: normalizeText(patch.pack_name ?? current.pack_name),
      pack_type: normalizePackType(patch.pack_type ?? current.pack_type),
      price: normalizeInt(patch.price ?? current.price, 0),
      description: normalizeNullableText(patch.description ?? current.description),
      panel_summary: normalizeNullableText(patch.panel_summary ?? current.panel_summary),
      sort_order: normalizeInt(patch.sort_order ?? current.sort_order, 0),
      updated_by: normalizeNullableText(patch.updated_by ?? current.updated_by),
    };

    const { rows } = await pool.query(
      `update tb_donate_pack_master
       set
         pack_code = $2,
         pack_name = $3,
         pack_type = $4,
         price = $5,
         description = $6,
         panel_summary = $7,
         sort_order = $8,
         updated_by = $9,
         updated_at = now()
       where pack_id = $1
       returning *`,
      [
        packId,
        next.pack_code,
        next.pack_name,
        next.pack_type,
        next.price,
        next.description,
        next.panel_summary,
        next.sort_order,
        next.updated_by,
      ]
    );

    return rows[0] ?? null;
  },

  async togglePack(packId, actor = null) {
    const { rows } = await pool.query(
      `update tb_donate_pack_master
       set
         is_active = not is_active,
         updated_by = coalesce($2, updated_by),
         updated_at = now()
       where pack_id = $1
       returning *`,
      [packId, normalizeNullableText(actor)]
    );
    return rows[0] ?? null;
  },

  async getNextSortOrder() {
    const { rows } = await pool.query(
      `select coalesce(max(sort_order), 0) + 10 as next_sort_order
       from tb_donate_pack_master`
    );
    return Number(rows[0]?.next_sort_order || 10);
  },

  async getPackDetails(packCode) {
    const pack = await this.getPackByCode(packCode);
    if (!pack) return null;

    const [{ rows: benefitRows }, { rows: itemRows }, { rows: vehicleRows }, { rows: boatRows }] =
      await Promise.all([
        pool.query(
          `select benefit_text, sort_order
           from tb_donate_pack_master_benefit
           where pack_id = $1 and is_active = true
           order by sort_order asc, benefit_id asc`,
          [pack.pack_id]
        ),
        pool.query(
          `select
             item_code,
             item_name,
             item_spawn_name,
             item_spawn_command_template,
             quantity,
             item_group,
             sort_order
           from tb_donate_pack_master_item
           where pack_id = $1 and is_active = true
           order by sort_order asc, pack_item_id asc`,
          [pack.pack_id]
        ),
        pool.query(
          `select
             vehicle_code,
             vehicle_name,
             vehicle_model,
             vehicle_kind,
             spawn_command_template,
             insurance_total,
             insurance_days,
             sort_order
           from tb_donate_pack_master_vehicle
           where pack_id = $1 and is_active = true
           order by sort_order asc, pack_vehicle_id asc`,
          [pack.pack_id]
        ),
        pool.query(
          `select
             boat_code,
             boat_name,
             boat_model,
             spawn_command_template,
             insurance_total,
             insurance_days,
             sort_order
           from tb_donate_pack_master_boat
           where pack_id = $1 and is_active = true
           order by sort_order asc, pack_boat_id asc`,
          [pack.pack_id]
        ),
      ]);

    const benefits = benefitRows.map((x) => x.benefit_text).filter(Boolean);
    const displayItems = itemRows.map(
      (x) => `${x.item_name}${Number(x.quantity) > 1 ? ` x${x.quantity}` : ""}`
    );
    const spawnItems = itemRows.map((x) => x.item_spawn_command_template).filter(Boolean);

    return {
      ...pack,
      benefits,
      items: itemRows,
      displayItems,
      spawnItems,
      summary_lines: normalizeSummary(pack, itemRows, vehicleRows, boatRows)
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      vehicleChoices: vehicleRows.map((x) => x.vehicle_name),
      vehicleChoiceMap: vehicleRows.reduce((acc, x) => {
        acc[x.vehicle_name] = x;
        return acc;
      }, {}),
      boatChoices: boatRows.map((x) => x.boat_name),
      boatChoiceMap: boatRows.reduce((acc, x) => {
        acc[x.boat_name] = x;
        return acc;
      }, {}),
      carInsurance:
        Number(pack.car_insurance_total) > 0
          ? {
              total: Number(pack.car_insurance_total),
              days: Number(pack.car_insurance_days),
            }
          : null,
      boatInsurance:
        Number(pack.boat_insurance_total) > 0
          ? {
              total: Number(pack.boat_insurance_total),
              days: Number(pack.boat_insurance_days),
            }
          : null,
    };
  },
};
