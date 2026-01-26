begin;

drop trigger if exists trg_orders_updated on orders;
drop trigger if exists trg_vip_updated on vip_subscriptions;
drop trigger if exists trg_vehicles_updated on vehicles;
drop trigger if exists trg_vehicle_insurance_updated on vehicle_insurance;

drop function if exists set_updated_at();

drop table if exists donate_totals cascade;
drop table if exists insurance_logs cascade;
drop table if exists vehicle_insurance cascade;
drop table if exists vehicles cascade;
drop table if exists boost_claims cascade;
drop table if exists vip_subscriptions cascade;
drop table if exists orders cascade;
drop table if exists audit_logs cascade;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table orders (
  id bigserial primary key,
  order_no text unique not null,

  guild_id text not null,
  user_id text not null,
  user_tag text not null,

  type text not null check (type in ('DONATE','BOOST','VIP')),
  pack_code text not null,

  amount int not null check (amount >= 0),

  ign text not null,
  steam_id text not null check (steam_id ~ '^[0-9]{17}$'),
  note text,

  ticket_channel_id text,
  queue_message_id text,

  selected_vehicle text,
  selected_boat text,

  plate text check (plate is null or plate ~ '^[0-9]{6}$'),

  slip_message_ids text[] not null default '{}',

  status text not null check (status in ('PENDING','APPROVED','REJECTED','CANCELLED','SUCCESS')) default 'PENDING',

  staff_last_action_by text,
  staff_last_action_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_status on orders(status);
create index idx_orders_user on orders(user_id);
create index idx_orders_created_at on orders(created_at);
create index idx_orders_plate on orders(plate);

create trigger trg_orders_updated
before update on orders
for each row execute function set_updated_at();

create table vehicles (
  id bigserial primary key,
  guild_id text not null,

  plate text not null check (plate ~ '^[0-9]{6}$'),
  kind text not null check (kind in ('CAR','BOAT')),
  model text not null,

  owner_user_id text not null,
  owner_tag text not null,

  order_no text references orders(order_no) on delete set null,

  active boolean not null default true,

  registered_at timestamptz not null default now(),
  registered_by text,

  updated_at timestamptz not null default now(),

  constraint uq_vehicles_plate unique (plate)
);

create index idx_vehicles_owner on vehicles(owner_user_id);
create index idx_vehicles_kind on vehicles(kind);

create trigger trg_vehicles_updated
before update on vehicles
for each row execute function set_updated_at();

create table vehicle_insurance (
  id bigserial primary key,

  plate text not null references vehicles(plate) on delete cascade,
  kind text not null check (kind in ('CAR','BOAT')),

  total int not null default 0 check (total >= 0),
  used int not null default 0 check (used >= 0),
  expire_at timestamptz,

  order_no text references orders(order_no) on delete set null,
  source text not null default 'DONATE_PACK' check (source in ('DONATE_PACK','VIP','MANUAL')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_vehicle_insurance_plate_kind unique (plate, kind),
  constraint chk_insurance_used_le_total check (used <= total)
);

create index idx_vehicle_insurance_expire on vehicle_insurance(expire_at);
create index idx_vehicle_insurance_plate on vehicle_insurance(plate);

create trigger trg_vehicle_insurance_updated
before update on vehicle_insurance
for each row execute function set_updated_at();

create table insurance_logs (
  id bigserial primary key,

  guild_id text not null,
  plate text not null check (plate ~ '^[0-9]{6}$'),
  kind text not null check (kind in ('CAR','BOAT')),

  action text not null check (action in ('GRANT','USE','ADJUST')),
  delta int not null,

  order_no text references orders(order_no) on delete set null,
  user_id text,
  staff_id text,

  note text,
  created_at timestamptz not null default now()
);

create index idx_insurance_logs_plate on insurance_logs(plate);
create index idx_insurance_logs_created on insurance_logs(created_at);

create table vip_subscriptions (
  id bigserial primary key,

  guild_id text not null,
  user_id text not null,
  user_tag text not null,

  vip_code text not null check (vip_code in ('BASIC','PRO','ELITE')),
  role_id text not null,

  active boolean not null default true,

  start_at timestamptz not null default now(),
  expire_at timestamptz not null,
  next_grant_at timestamptz not null,
  last_grant_at timestamptz,

  warned_24h boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_vip_active on vip_subscriptions(active);
create index idx_vip_next_grant on vip_subscriptions(next_grant_at);
create index idx_vip_expire on vip_subscriptions(expire_at);
create index idx_vip_user on vip_subscriptions(user_id);

create trigger trg_vip_updated
before update on vip_subscriptions
for each row execute function set_updated_at();

create table boost_claims (
  id bigserial primary key,
  ign text not null,
  boost_code text not null,
  order_no text unique not null references orders(order_no) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_boost_once_per_ign unique (ign, boost_code)
);

create index idx_boost_claims_ign on boost_claims(ign);

create table donate_totals (
  id bigserial primary key,
  day date not null,
  guild_id text not null,
  donate_amount int not null default 0,
  cases int not null default 0,
  updated_at timestamptz not null default now(),
  constraint uq_donate_totals_day_guild unique (day, guild_id)
);

create index idx_donate_totals_day on donate_totals(day);

create table audit_logs (
  id bigserial primary key,

  guild_id text not null,
  actor_id text,
  actor_tag text,

  action text not null,
  target text,
  meta jsonb,

  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on audit_logs(created_at);
create index idx_audit_logs_action on audit_logs(action);

commit;
