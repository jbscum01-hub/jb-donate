// src/db/queries.js
// Centralized SQL strings for pg (Neon / Supabase Postgres)

export const SQL = {
  // =========================
  // Orders
  // =========================
  insertOrder: `
    insert into orders (
      order_no, guild_id, user_id, user_tag,
      type, pack_code, amount,
      ign, steam_id, note,
      ticket_channel_id, status
    )
    values (
      $1,$2,$3,$4,
      $5,$6,$7,
      $8,$9,$10,
      $11,'PENDING'
    )
    returning *
  `,
  getOrderByNo: `select * from orders where order_no=$1`,
  setOrderStatus: `
    update orders
    set status=$2, staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  setOrderSelection: `
    update orders
    set selected_vehicle=$2, selected_boat=$3
    where order_no=$1
    returning *
  `,
  setOrderCarPlate: `
    update orders
    set car_plate=$2, plate_set_by=$3, plate_set_at=now(), staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  setOrderBoatPlate: `
    update orders
    set boat_plate=$2, plate_set_by=$3, plate_set_at=now(), staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  // backward compatible (if some code still uses plate)
  setOrderPlate: `
    update orders
    set plate=$2, plate_set_by=$3, plate_set_at=now(), staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  setOrderQueueMsg: `
    update orders set queue_message_id=$2 where order_no=$1
  `,

  getOrdersDashboardStats: `
    with tz as (
      select
        (date_trunc('day', now() at time zone 'Asia/Bangkok')) as day_start_th,
        (date_trunc('day', (now() at time zone 'Asia/Bangkok') + interval '1 day')) as day_end_th
    )
    select
      coalesce(sum(o.amount), 0)::bigint as total_amount,
      count(*)::bigint as total_orders,

      coalesce(sum(
        case
          when (o.created_at at time zone 'Asia/Bangkok') >= (select day_start_th from tz)
           and (o.created_at at time zone 'Asia/Bangkok') <  (select day_end_th from tz)
          then o.amount else 0
        end
      ), 0)::bigint as today_amount,

      count(
        case
          when (o.created_at at time zone 'Asia/Bangkok') >= (select day_start_th from tz)
           and (o.created_at at time zone 'Asia/Bangkok') <  (select day_end_th from tz)
          then 1 else null
        end
      )::bigint as today_orders,

      count(case when o.status = 'PENDING'   then 1 end)::bigint as pending_orders,
      count(case when o.status = 'APPROVED'  then 1 end)::bigint as approved_orders,
      count(case when o.status = 'DELIVERED' then 1 end)::bigint as delivered_orders,
      count(case when o.status = 'CLOSED'    then 1 end)::bigint as closed_orders,
      count(case when o.status = 'CANCELED'  then 1 end)::bigint as canceled_orders

    from orders o
    where o.guild_id = $1;
  `,  

  // =========================
  // Vehicles
  // =========================
  upsertVehicle: `
    insert into vehicles (
      guild_id, plate, kind, model,
      owner_user_id, owner_tag, order_no,
      registered_by
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict (plate) do update set
      guild_id=excluded.guild_id,
      kind=excluded.kind,
      model=excluded.model,
      owner_user_id=excluded.owner_user_id,
      owner_tag=excluded.owner_tag,
      order_no=excluded.order_no,
      registered_by=excluded.registered_by,
      updated_at=now()
    returning *
  `,
  getVehicleByPlate: `select * from vehicles where plate=$1`,
  setVehicleCardMessageId: `
    update vehicles set plate_card_message_id=$2 where plate=$1 returning *
  `,

  // =========================
  // Insurance
  // RULE: insurance must always have expire_at (no NULL expire_at)
  // - accumulate: total += add_total
  // - keep used (do NOT reset used)
  // - extend expiry from max(expire_at, now()) by days_to_add
  //
  // params:
  // $1 plate
  // $2 kind
  // $3 add_total
  // $4 used_initial (0)
  // $5 days_to_add (must be > 0 for insurance packs)
  // $6 order_no
  // $7 source
  // =========================
  upsertVehicleInsurance: `
    insert into vehicle_insurance (plate,kind,total,used,expire_at,order_no,source)
    values (
      $1, $2,
      $3,
      $4,
      (now() + ($5 || ' days')::interval),
      $6, $7
    )
    on conflict (plate,kind) do update set
      total = vehicle_insurance.total + excluded.total,
      used  = vehicle_insurance.used,
      expire_at = (
        greatest(vehicle_insurance.expire_at, now())
        + (($5 || ' days')::interval)
      ),
      order_no = excluded.order_no,
      source   = excluded.source,
      updated_at = now()
    returning *
  `,
  getVehicleInsurance: `
    select * from vehicle_insurance where plate=$1 and kind=$2
  `,
  useVehicleInsurance: `
    update vehicle_insurance
    set used = used + 1, updated_at=now()
    where plate=$1
      and kind=$2
      and expire_at > now()
      and used < total
    returning *
  `,
  insertInsuranceLog: `
    insert into insurance_logs (guild_id,plate,kind,action,delta,order_no,user_id,staff_id,note)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `,

  // =========================
  // Audit
  // =========================
  insertAudit: `
    insert into audit_logs (guild_id,actor_id,actor_tag,action,target,meta)
    values ($1,$2,$3,$4,$5,$6)
  `,
};
