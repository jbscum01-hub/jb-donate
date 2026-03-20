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

function normalizePackBase(pack) {
  return {
    ...pack,
    price: Number(pack.price || 0),
    sort_order: Number(pack.sort_order || 0),
    is_active: Boolean(pack.is_active),
    allow_vehicle_select: Boolean(pack.allow_vehicle_select),
    allow_boat_select: Boolean(pack.allow_boat_select),
    car_insurance_total: Number(pack.car_insurance_total || 0),
    car_insurance_days: Number(pack.car_insurance_days || 0),
    boat_insurance_total: Number(pack.boat_insurance_total || 0),
    boat_insurance_days: Number(pack.boat_insurance_days || 0),
    vip_days: Number(pack.vip_days || 0),
  };
}

async function getPackSummaryMaps(packIds) {
  if (!packIds.length) {
    return {
      itemMap: new Map(),
      vehicleMap: new Map(),
      boatMap: new Map(),
    };
  }

  const [{ rows: itemRows }, { rows: vehicleRows }, { rows: boatRows }] = await Promise.all([
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

  return { itemMap, vehicleMap, boatMap };
}

async function getOrdersCountByPackId(packId) {
  const { rows } = await pool.query(
    `select count(*)::int as total
     from tb_donate_orders
     where pack_id = $1`,
    [packId]
  );
  return Number(rows[0]?.total || 0);
}

export const DonatePackRepo = {
  async listManagePacks({ page = 1, limit = 10, includeInactive = true } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(25, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    const whereSql = includeInactive ? "" : "where is_active = true";
    const countSql = `select count(*)::int as total from tb_donate_pack_master ${whereSql}`;
    const listSql = `
      select
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
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      from tb_donate_pack_master
      ${whereSql}
      order by sort_order asc, pack_code asc
      limit $1 offset $2
    `;

    const [{ rows: countRows }, { rows }] = await Promise.all([
      pool.query(countSql),
      pool.query(listSql, [safeLimit, offset]),
    ]);

    const normalizedRows = rows.map(normalizePackBase);
    const packIds = normalizedRows.map((x) => x.pack_id);
    const { itemMap, vehicleMap, boatMap } = await getPackSummaryMaps(packIds);

    return {
      page: safePage,
      limit: safeLimit,
      total: Number(countRows[0]?.total || 0),
      rows: normalizedRows.map((pack) => ({
        ...pack,
        summary_lines: normalizeSummary(pack, itemMap.get(pack.pack_id) ?? [], vehicleMap.get(pack.pack_id) ?? [], boatMap.get(pack.pack_id) ?? [])
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      })),
    };
  },

  async listAllManagePacks() {
    const result = await this.listManagePacks({ page: 1, limit: 100, includeInactive: true });
    return result.rows;
  },

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

    const normalizedPacks = packs.map(normalizePackBase);
    const packIds = normalizedPacks.map((x) => x.pack_id);
    const { itemMap, vehicleMap, boatMap } = await getPackSummaryMaps(packIds);

    return normalizedPacks.map((pack) => {
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
         is_active,
         created_at,
         updated_at,
         created_by,
         updated_by
       from tb_donate_pack_master
       where pack_id = $1
       limit 1`,
      [packId]
    );

    const row = rows[0] ?? null;
    return row ? normalizePackBase(row) : null;
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
         is_active,
         created_at,
         updated_at,
         created_by,
         updated_by
       from tb_donate_pack_master
       where upper(pack_code) = upper($1)
       limit 1`,
      [packCode]
    );

    const row = rows[0] ?? null;
    return row ? normalizePackBase(row) : null;
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

  async createPack({
    pack_code,
    pack_name,
    pack_type,
    price,
    description,
    sort_order,
    is_active,
    panel_summary,
    image_url,
    embed_color,
    actorTag,
  }) {
    const { rows } = await pool.query(
      `insert into tb_donate_pack_master
       (
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         sort_order,
         is_active,
         panel_summary,
         image_url,
         embed_color,
         created_by,
         updated_by
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       returning *`,
      [
        pack_code,
        pack_name,
        pack_type,
        price,
        description,
        sort_order,
        is_active,
        panel_summary,
        image_url,
        embed_color,
        actorTag ?? null,
      ]
    );
    return normalizePackBase(rows[0]);
  },

  async updatePackFields(packId, fields, actorTag) {
    const allowed = [
      "pack_name",
      "description",
      "price",
      "pack_type",
      "sort_order",
      "panel_summary",
      "image_url",
      "embed_color",
      "is_active",
    ];

    const setParts = [];
    const values = [];
    let i = 1;

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        setParts.push(`${key} = $${i++}`);
        values.push(fields[key]);
      }
    }

    if (!setParts.length) {
      return this.getPackById(packId);
    }

    setParts.push(`updated_at = now()`);
    setParts.push(`updated_by = $${i++}`);
    values.push(actorTag ?? null);
    values.push(packId);

    const { rows } = await pool.query(
      `update tb_donate_pack_master
       set ${setParts.join(", ")}
       where pack_id = $${i}
       returning *`,
      values
    );

    return rows[0] ? normalizePackBase(rows[0]) : null;
  },

  async countOrdersByPackId(packId) {
    return getOrdersCountByPackId(packId);
  },
};
