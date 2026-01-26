export const SQL = {
  // Orders
  insertOrder: `
    insert into orders (order_no,guild_id,user_id,user_tag,type,pack_code,amount,ign,steam_id,note,ticket_channel_id,status)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING')
    returning *
  `,
  getOrderByNo: `select * from orders where order_no=$1`,
  setOrderStatus: `
    update orders set status=$2, staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1 returning *
  `,
  setOrderSelection: `
    update orders set selected_vehicle=$2, selected_boat=$3
    where order_no=$1 returning *
  `,
  setOrderPlate: `
    update orders set plate=$2, staff_last_action_by=$3, staff_last_action_at=now()
    where order_no=$1 returning *
  `,
  setOrderQueueMsg: `update orders set queue_message_id=$2 where order_no=$1`,

  // Vehicles
  upsertVehicle: `
    insert into vehicles (guild_id,plate,kind,model,owner_user_id,owner_tag,order_no,registered_by)
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

  // Insurance
  upsertVehicleInsurance: `
    insert into vehicle_insurance (plate,kind,total,used,expire_at,order_no,source)
    values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (plate,kind) do update set
      total=excluded.total,
      used=excluded.used,
      expire_at=excluded.expire_at,
      order_no=excluded.order_no,
      source=excluded.source,
      updated_at=now()
    returning *
  `,
  getVehicleInsurance: `select * from vehicle_insurance where plate=$1 and kind=$2`,
  useVehicleInsurance: `
    update vehicle_insurance
    set used = used + 1, updated_at=now()
    where plate=$1 and kind=$2 and (expire_at is null or expire_at > now()) and used < total
    returning *
  `,
  insertInsuranceLog: `
    insert into insurance_logs (guild_id,plate,kind,action,delta,order_no,user_id,staff_id,note)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `,

  // Audit
  insertAudit: `
    insert into audit_logs (guild_id,actor_id,actor_tag,action,target,meta)
    values ($1,$2,$3,$4,$5,$6)
  `,
};
