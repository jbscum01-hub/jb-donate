// src/db/queries.js
// Centralized SQL strings for pg (Neon / Supabase Postgres)

export const SQL = {
  // =========================
  // Orders
  // =========================
  insertOrder: `
    insert into tb_donate_orders (
      order_no, guild_id, user_id, user_tag,
      type, pack_id, pack_code, amount,
      ign, steam_id, note,
      ticket_channel_id, status
    )
    values (
      $1,$2,$3,$4,
      $5,$6,$7,$8,
      $9,$10,$11,
      $12,'PENDING'
    )
    returning *
  `,
  getOrderByNo: `select * from tb_donate_orders where order_no=$1`,
  findOpenOrderByUser: `
    select *
    from tb_donate_orders
    where guild_id = $1
      and user_id = $2
      and status in ('PENDING', 'APPROVED')
    order by created_at desc
    limit 1
  `,
  setOrderStatus: `
    update tb_donate_orders
    set status=$2, staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  setOrderSelection: `
    update tb_donate_orders
    set selected_vehicle=$2, selected_boat=$3
    where order_no=$1
    returning *
  `,
  setOrderCarPlate: `
    update tb_donate_orders
    set car_plate=$2, plate_set_by=$3, plate_set_at=now(), staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  setOrderBoatPlate: `
    update tb_donate_orders
    set boat_plate=$2, plate_set_by=$3, plate_set_at=now(), staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  setOrderPlate: `
    update tb_donate_orders
    set plate=$2, plate_set_by=$3, plate_set_at=now(), staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1
    returning *
  `,
  setOrderQueueMsg: `
    update tb_donate_orders set queue_message_id=$2 where order_no=$1
  `,
  getOpenQueueCount: `
    select count(*)::bigint as queue_count
    from tb_donate_orders
    where guild_id = $1
      and status in ('PENDING', 'APPROVED')
  `,

  getOrdersDashboardStats: `
    with tz as (
      select
        (date_trunc('day', now() at time zone 'Asia/Bangkok')) as day_start_th,
        (date_trunc('day', (now() at time zone 'Asia/Bangkok') + interval '1 day')) as day_end_th
    )
    select
      coalesce(sum(case when o.status = 'SUCCESS' then o.amount else 0 end), 0)::bigint as total_amount,
      count(case when o.status = 'SUCCESS' then 1 end)::bigint as total_orders,
      coalesce(sum(
        case
          when o.status = 'SUCCESS'
           and (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') >= (select day_start_th from tz)
           and (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') <  (select day_end_th from tz)
          then o.amount else 0
        end
      ), 0)::bigint as today_amount,
      count(
        case
          when o.status = 'SUCCESS'
           and (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') >= (select day_start_th from tz)
           and (o.created_at at time zone 'UTC' at time zone 'Asia/Bangkok') <  (select day_end_th from tz)
          then 1 else null
        end
      )::bigint as today_orders,
      count(case when o.status = 'PENDING' then 1 end)::bigint as pending_orders,
      count(case when o.status = 'APPROVED' then 1 end)::bigint as approved_orders,
      count(case when o.status = 'SUCCESS' then 1 end)::bigint as success_orders,
      count(case when o.status = 'CANCELLED' then 1 end)::bigint as cancelled_orders
    from tb_donate_orders o
    where o.guild_id = $1;
  `,

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
      from tb_donate_orders o
      where o.guild_id = $1
    )
    select
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='PENDING' then 1 end)::bigint as today_pending,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='APPROVED' then 1 end)::bigint as today_approved,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='SUCCESS' then 1 end)::bigint as today_success,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='CANCELLED' then 1 end)::bigint as today_cancelled,
      coalesce(sum(case when b.created_th >= (select day_start_th from tz)
                         and b.created_th <  (select day_end_th from tz)
                         and b.status='SUCCESS'
                         and b.type='DONATE' then b.amount else 0 end),0)::bigint as today_donate_amount,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='SUCCESS'
                 and b.type='DONATE' then 1 end)::bigint as today_donate_orders,
      coalesce(sum(case when b.created_th >= (select day_start_th from tz)
                         and b.created_th <  (select day_end_th from tz)
                         and b.status='SUCCESS'
                         and b.type='VIP' then b.amount else 0 end),0)::bigint as today_vip_amount,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='SUCCESS'
                 and b.type='VIP' then 1 end)::bigint as today_vip_orders,
      coalesce(sum(case when b.created_th >= (select day_start_th from tz)
                         and b.created_th <  (select day_end_th from tz)
                         and b.status='SUCCESS'
                         and b.type='BOOST' then b.amount else 0 end),0)::bigint as today_boost_amount,
      count(case when b.created_th >= (select day_start_th from tz)
                 and b.created_th <  (select day_end_th from tz)
                 and b.status='SUCCESS'
                 and b.type='BOOST' then 1 end)::bigint as today_boost_orders,
      count(case when b.status='PENDING' and b.created_at <= now() - interval '24 hours' then 1 end)::bigint as pending_over_24h,
      min(case when b.status='PENDING' then b.created_th end) as oldest_pending_th
    from base b;
  `,

  getOrdersRecent: `
    select order_no, type, pack_code, amount, status, user_tag,
           (created_at at time zone 'UTC' at time zone 'Asia/Bangkok') as created_th
    from tb_donate_orders
    where guild_id=$1
    order by created_at desc
    limit $2;
  `,

  getOrdersTopPacks7d: `
    select pack_code,
           count(*)::bigint as orders,
           coalesce(sum(amount),0)::bigint as amount
    from tb_donate_orders
    where guild_id=$1
      and status='SUCCESS'
      and created_at >= (now() - interval '7 days')
    group by pack_code
    order by amount desc, orders desc
    limit $2;
  `,

  // =========================
  // VIP Subscriptions
  // =========================
  upsertVipSubscription: `
    insert into tb_donate_vip_subscriptions (
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
      expire_at = greatest(tb_donate_vip_subscriptions.expire_at, now())
              + ($5::int * interval '1 day'),
      next_grant_at = coalesce(tb_donate_vip_subscriptions.next_grant_at, now())
    returning *;
  `,

  // =========================
  // Vehicles
  // =========================
  upsertVehicle: `
    insert into tb_donate_vehicles (
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
  getVehicleByPlate: `select * from tb_donate_vehicles where plate=$1`,
  setVehicleCardMessageId: `
    update tb_donate_vehicles set plate_card_message_id=$2 where plate=$1 returning *
  `,
  setVehicleOwner: `
    update tb_donate_vehicles
    set owner_user_id=$2,
        owner_tag=$3,
        updated_at=now()
    where plate=$1
    returning *
  `,

  // =========================
  // Insurance
  // =========================
  upsertVehicleInsurance: `
    insert into tb_donate_vehicle_insurance (plate,kind,total,used,expire_at,order_no,source)
    values (
      $1, $2,
      $3,
      $4,
      (now() + ($5 || ' days')::interval),
      $6, $7
    )
    on conflict (plate,kind) do update set
      total = tb_donate_vehicle_insurance.total + excluded.total,
      used  = tb_donate_vehicle_insurance.used,
      expire_at = (
        greatest(tb_donate_vehicle_insurance.expire_at, now())
        + (($5 || ' days')::interval)
      ),
      order_no = excluded.order_no,
      source   = excluded.source,
      updated_at = now()
    returning *
  `,
  getVehicleInsurance: `
    select * from tb_donate_vehicle_insurance where plate=$1 and kind=$2
  `,
  useVehicleInsurance: `
    update tb_donate_vehicle_insurance
    set used = used + 1,
        updated_at = now()
    where plate=$1
      and kind=$2
      and expire_at > now()
      and used < total
    returning *
  `,
  insertInsuranceLog: `
    insert into tb_donate_insurance_logs (guild_id,plate,kind,action,delta,order_no,user_id,staff_id,note)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    returning *
  `,
};
