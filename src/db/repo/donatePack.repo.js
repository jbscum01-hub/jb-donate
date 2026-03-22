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

function sanitizeText(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

function normalizeCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_\-]/g, "");
}

function normalizeType(value) {
  const t = String(value ?? "DONATE").trim().toUpperCase();
  return ["DONATE", "VIP", "BOOST", "EVENT"].includes(t) ? t : "DONATE";
}

function toInt(value, fallback = 0) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
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
         p.pack_id,
         p.pack_code,
         p.pack_name,
         p.pack_type,
         p.price,
         p.sort_order,
         p.is_active,
         p.allow_vehicle_select,
         p.allow_boat_select,
         p.car_insurance_total,
         p.car_insurance_days,
         p.boat_insurance_total,
         p.boat_insurance_days,
         p.vip_code,
         p.vip_days,
         p.discord_role_id,
         p.discord_role_name,
         p.image_url,
         p.embed_color,
         p.panel_summary,
         p.description,
         p.updated_at,
         coalesce(b.benefit_count, 0)::int as benefit_count,
         coalesce(i.item_count, 0)::int as item_count,
         coalesce(v.vehicle_count, 0)::int as vehicle_count,
         coalesce(o.boat_count, 0)::int as boat_count
       from tb_donate_pack_master p
       left join (
         select pack_id, count(*) as benefit_count
         from tb_donate_pack_master_benefit
         where is_active = true
         group by pack_id
       ) b on b.pack_id = p.pack_id
       left join (
         select pack_id, count(*) as item_count
         from tb_donate_pack_master_item
         where is_active = true
         group by pack_id
       ) i on i.pack_id = p.pack_id
       left join (
         select pack_id, count(*) as vehicle_count
         from tb_donate_pack_master_vehicle
         where is_active = true
         group by pack_id
       ) v on v.pack_id = p.pack_id
       left join (
         select pack_id, count(*) as boat_count
         from tb_donate_pack_master_boat
         where is_active = true
         group by pack_id
       ) o on o.pack_id = p.pack_id
       order by p.sort_order asc, p.pack_code asc
       limit $1`,
      [Number(limit) || 25]
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
         updated_at,
         updated_by,
         created_by
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

  async createPack(input) {
    const code = normalizeCode(input.pack_code);
    const name = String(input.pack_name ?? "").trim();
    if (!code) throw new Error("Pack code is required");
    if (!name) throw new Error("Pack name is required");

    const { rows } = await pool.query(
      `insert into tb_donate_pack_master (
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         sort_order,
         is_active,
         panel_summary,
         created_by,
         updated_by
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       returning *`,
      [
        code,
        name,
        normalizeType(input.pack_type),
        Math.max(0, toInt(input.price, 0)),
        sanitizeText(input.description),
        Math.max(0, toInt(input.sort_order, 0)),
        input.is_active !== false,
        sanitizeText(input.panel_summary),
        sanitizeText(input.actor_tag) ?? sanitizeText(input.actor_id) ?? "system",
      ]
    );

    return rows[0] ?? null;
  },

  async updatePack(packId, input) {
    const oldPack = await this.getPackById(packId);
    if (!oldPack) return null;

    const next = {
      pack_name: String(input.pack_name ?? oldPack.pack_name).trim(),
      pack_type: normalizeType(input.pack_type ?? oldPack.pack_type),
      price: Math.max(0, toInt(input.price, oldPack.price)),
      sort_order: Math.max(0, toInt(input.sort_order, oldPack.sort_order)),
      description: sanitizeText(input.description ?? oldPack.description),
      panel_summary: sanitizeText(input.panel_summary ?? oldPack.panel_summary),
      updated_by: sanitizeText(input.actor_tag) ?? sanitizeText(input.actor_id) ?? oldPack.updated_by ?? "system",
    };

    if (!next.pack_name) throw new Error("Pack name is required");

    const { rows } = await pool.query(
      `update tb_donate_pack_master
       set pack_name = $2,
           pack_type = $3,
           price = $4,
           sort_order = $5,
           description = $6,
           panel_summary = $7,
           updated_by = $8,
           updated_at = now()
       where pack_id = $1
       returning *`,
      [
        packId,
        next.pack_name,
        next.pack_type,
        next.price,
        next.sort_order,
        next.description,
        next.panel_summary,
        next.updated_by,
      ]
    );

    return rows[0] ?? null;
  },

  async togglePack(packId, isActive, actorTag = null) {
    const { rows } = await pool.query(
      `update tb_donate_pack_master
       set is_active = $2,
           updated_by = $3,
           updated_at = now()
       where pack_id = $1
       returning *`,
      [packId, !!isActive, sanitizeText(actorTag) ?? "system"]
    );

    return rows[0] ?? null;
  },
};
