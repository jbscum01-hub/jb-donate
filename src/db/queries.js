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

  // ✅ Dashboard stats (Today based on Asia/Bangkok)
  // NOTE: created_at in your DB appears to be "timestamp without time zone" storing UTC values.
  // So we interpret it as UTC first, then convert to Asia/Bangkok.
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
          when (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') >= (select day_start_th from tz)
           and (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') <  (select day_end_th from tz)
          then o.amount else 0
        end
      ), 0)::bigint as today_amount,

      count(
        case
          when (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') >= (select day_start_th from tz)
           and (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') <  (select day_end_th from tz)
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

  // ✅ Dashboard extra stats (breakdowns + aging)
  getOrdersDashboardExtra: `
    with tz as (
      select
        (date_trunc('day', now() at time zone 'Asia/Bangkok')) as day_start_th,
        (date_trunc('day', (now() at time zone 'Asia/Bangkok') + interval '1 day')) as day_end_th
    ),
    base as (
      select
        o.*,
        (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') as created_th
      from orders o
      where o.guild_id = $1
    )
    select
      -- today status counts
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='PENDING' then 1 end)::bigint   as today_pending,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='APPROVED' then 1 end)::bigint  as today_approved,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='DELIVERED' then 1 end)::bigint as today_delivered,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='CLOSED' then 1 end)::bigint    as today_closed,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='CANCELED' then 1 end)::bigint  as today_canceled,

      -- today breakdown by type
      coalesce(sum(case when b.created_th >= (select day_start_th from tz)
                         and b.created_th <  (select day_end_th from tz)
                         and b.type='DONATE' then b.amount else 0 end),0)::bigint as today_donate_amount,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.type='DONATE' then 1 end)::bigint as today_donate_orders,

      coalesce(sum(case when b.created_th >= (select day_start_th from tz)
                         and b.created_th <  (select day_end_th from tz)
                         and b.type='VIP' then b.amount else 0 end),0)::bigint as today_vip_amount,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.type='VIP' then 1 end)::bigint as today_vip_orders,

      coalesce(sum(case when b.created_th >= (select day_start_th from tz)
                         and b.created_th <  (select day_end_th from tz)
                         and b.type='BOOST' then b.amount else 0 end),0)::bigint as today_boost_amount,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.type='BOOST' then 1 end)::bigint as today_boost_orders,

      -- pending aging
      count(case when b.status='PENDING' and b.created_at <= now() - interval '24 hours' then 1 end)::bigint as pending_over_24h,
      min(case when b.status='PENDING' then b.created_th end) as oldest_pending_th
    from base b;
  `,

  getOrdersRecent: `
    select order_no, type, pack_code, amount, status, user_tag,
           (created_at at time zone 'UTC' at time zone 'Asia/Bangkok') as created_th
    from orders
    where guild_id=$1
    order by created_at desc
    limit $2;
  `,

  getOrdersTopPacks7d: `
    select pack_code,
           count(*)::bigint as orders,
           coalesce(sum(amount),0)::bigint as amount
    from orders
    where guild_id=$1
      and created_at >= (now() - interval '7 days')
    group by pack_code
    order by amount desc, orders desc
    limit $2;
  `,

  // =========================
  // VIP Subscriptions
  // - create/extend VIP and set next_grant_at
  // params:
  // $1 guild_id (varchar)
  // $2 user_id (varchar)
  // $3 vip_code (varchar)
  // $4 role_id (varchar)
  // $5 days_to_add (int)
  // =========================
  upsertVipSubscription: `
    insert into vip_subscriptions (
      guild_id, user_id, vip_code, role_id,
      active, next_grant_at, expire_at, warned_24h
    )
    values (
      $1::varchar,
      $2::varchar,
      $3::varchar,
      $4::varchar,
      true,
      now(),
      now() + ($5::int * interval '1 day'),
      false
    )
    on conflict (guild_id, user_id, vip_code)
    do update set
      active = true,
      role_id = excluded.role_id,
      warned_24h = false,
      expire_at = greatest(vip_subscriptions.expire_at, now())
              + ($5::int * interval '1 day'),
      next_grant_at = coalesce(vip_subscriptions.next_grant_at, now())
    returning *;
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
