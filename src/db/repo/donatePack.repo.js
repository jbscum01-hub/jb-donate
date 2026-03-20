import { pool } from "../pool.js";

export const DonatePackRepo = {
  async listActiveShopOptions() {
    const { rows } = await pool.query(
      `select
         pack_id,
         pack_code,
         pack_name,
         pack_type,
         price,
         description,
         sort_order,
         embed_color,
         allow_vehicle_select,
         allow_boat_select
       from tb_donate_pack_master
       where is_active = true
       order by sort_order asc, pack_code asc`
    );
    return rows;
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

    const [{ rows: benefitRows }, { rows: itemRows }, { rows: vehicleRows }, { rows: boatRows }] = await Promise.all([
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
    const displayItems = itemRows.map((x) => `${x.item_name}${Number(x.quantity) > 1 ? ` x${x.quantity}` : ""}`);
    const spawnItems = itemRows
      .map((x) => x.item_spawn_command_template)
      .filter(Boolean);

    return {
      ...pack,
      benefits,
      items: itemRows,
      displayItems,
      spawnItems,
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
          ? { total: Number(pack.car_insurance_total), days: Number(pack.car_insurance_days) }
          : null,
      boatInsurance:
        Number(pack.boat_insurance_total) > 0
          ? { total: Number(pack.boat_insurance_total), days: Number(pack.boat_insurance_days) }
          : null,
    };
  },
};
