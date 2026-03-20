begin;

-- =====================================================
-- Donate schema (aligned with current bot code)
-- =====================================================

create extension if not exists pgcrypto;

-- cleanup old triggers/functions

drop trigger if exists trg_tb_donate_orders_updated on tb_donate_orders;
drop trigger if exists trg_tb_donate_vip_subscriptions_updated on tb_donate_vip_subscriptions;
drop trigger if exists trg_tb_donate_vehicles_updated on tb_donate_vehicles;
drop trigger if exists trg_tb_donate_vehicle_insurance_updated on tb_donate_vehicle_insurance;
drop trigger if exists trg_tb_donate_pack_master_updated on tb_donate_pack_master;

drop function if exists set_updated_at();

-- cleanup old donate tables

drop table if exists tb_donate_totals cascade;
drop table if exists tb_donate_insurance_logs cascade;
drop table if exists tb_donate_vehicle_insurance cascade;
drop table if exists tb_donate_vehicles cascade;
drop table if exists boost_claims cascade;
drop table if exists tb_donate_vip_subscriptions cascade;
drop table if exists tb_donate_pack_master_vehicle cascade;
drop table if exists tb_donate_pack_master_item cascade;
drop table if exists tb_donate_pack_master_boat cascade;
drop table if exists tb_donate_pack_master_benefit cascade;
drop table if exists tb_donate_orders cascade;
drop table if exists tb_donate_pack_master cascade;
drop table if exists tb_donate_discord_config cascade;
drop table if exists audit_logs cascade;

-- cleanup legacy tables from older project versions

drop table if exists donate_totals cascade;
drop table if exists insurance_logs cascade;
drop table if exists vehicle_insurance cascade;
drop table if exists vehicles cascade;
drop table if exists vip_subscriptions cascade;
drop table if exists orders cascade;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table audit_logs (
  id bigserial primary key,
  guild_id varchar(32) not null,
  actor_id varchar(32),
  actor_tag varchar(100),
  action varchar(50) not null,
  target text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on audit_logs(created_at);
create index idx_audit_logs_action on audit_logs(action);

create table tb_donate_discord_config (
  config_id uuid primary key default gen_random_uuid(),
  scope_type varchar(50) not null,
  scope_key varchar(100) not null,
  config_key varchar(100) not null,
  config_value text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ux_tb_shop_discord_config_scope unique (scope_type, scope_key, config_key)
);

create index ix_tb_shop_discord_config_key on tb_donate_discord_config(config_key);
create index ix_tb_shop_discord_config_scope on tb_donate_discord_config(scope_type, scope_key);

create table tb_donate_pack_master (
  pack_id uuid primary key default gen_random_uuid(),
  pack_code varchar(50) not null unique,
  pack_name varchar(150) not null,
  pack_type varchar(30) not null default 'DONATE' check (pack_type in ('DONATE','VIP','BOOST','EVENT')),
  price integer not null default 0 check (price >= 0),
  description text,
  panel_summary text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  allow_vehicle_select boolean not null default false,
  allow_boat_select boolean not null default false,
  car_insurance_total integer not null default 0 check (car_insurance_total >= 0),
  car_insurance_days integer not null default 0 check (car_insurance_days >= 0),
  boat_insurance_total integer not null default 0 check (boat_insurance_total >= 0),
  boat_insurance_days integer not null default 0 check (boat_insurance_days >= 0),
  vip_code varchar(50),
  vip_days integer not null default 0 check (vip_days >= 0),
  discord_role_id varchar(32),
  discord_role_name varchar(100),
  image_url text,
  embed_color integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by varchar(100),
  updated_by varchar(100)
);

create index ix_tb_donate_pack_master_active_sort on tb_donate_pack_master(is_active, sort_order);

create table tb_donate_pack_master_benefit (
  benefit_id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references tb_donate_pack_master(pack_id) on delete cascade,
  benefit_text text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_tb_donate_pack_benefit_pack_active_sort
  on tb_donate_pack_master_benefit(pack_id, is_active, sort_order);

create table tb_donate_pack_master_item (
  pack_item_id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references tb_donate_pack_master(pack_id) on delete cascade,
  item_code varchar(100),
  item_name varchar(255) not null,
  item_spawn_name varchar(255),
  item_spawn_command_template text,
  quantity integer not null default 1 check (quantity > 0),
  item_group varchar(50),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_tb_donate_pack_item_pack_active_sort
  on tb_donate_pack_master_item(pack_id, is_active, sort_order);

create table tb_donate_pack_master_vehicle (
  pack_vehicle_id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references tb_donate_pack_master(pack_id) on delete cascade,
  vehicle_code varchar(100),
  vehicle_name varchar(255) not null,
  vehicle_model varchar(100) not null,
  vehicle_kind varchar(10) not null default 'CAR' check (vehicle_kind in ('CAR','BOAT')),
  spawn_command_template text,
  insurance_total integer not null default 0 check (insurance_total >= 0),
  insurance_days integer not null default 0 check (insurance_days >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_tb_donate_pack_vehicle_pack_active_sort
  on tb_donate_pack_master_vehicle(pack_id, is_active, sort_order);

create table tb_donate_pack_master_boat (
  pack_boat_id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references tb_donate_pack_master(pack_id) on delete cascade,
  boat_code varchar(100),
  boat_name varchar(255) not null,
  boat_model varchar(100) not null,
  spawn_command_template text,
  insurance_total integer not null default 0 check (insurance_total >= 0),
  insurance_days integer not null default 0 check (insurance_days >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_tb_donate_pack_boat_pack_active_sort
  on tb_donate_pack_master_boat(pack_id, is_active, sort_order);

create table tb_donate_orders (
  id bigserial primary key,
  order_no varchar(20) not null unique,
  user_id varchar(32) not null,
  user_tag varchar(100),
  ign varchar(100) not null,
  steam_id varchar(32) not null,
  pack_code varchar(50) not null,
  vehicle_model varchar(50),
  vehicle_kind varchar(10),
  plate varchar(20),
  status varchar(20) not null default 'PENDING' check (status in ('PENDING','APPROVED','CANCELLED','SUCCESS')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  guild_id varchar(32) not null,
  channel_id varchar(32),
  staff_id varchar(32),
  type varchar(50),
  amount integer default 0,
  note text,
  ticket_channel_id varchar(32),
  boat_model varchar(50),
  queue_message_id varchar(32),
  staff_last_action_by varchar(32),
  staff_last_action_at timestamptz,
  selected_vehicle varchar(50),
  selected_boat varchar(50),
  plate_set_by varchar(32),
  plate_set_at timestamptz,
  car_plate varchar(20),
  boat_plate varchar(20),
  pack_id uuid references tb_donate_pack_master(pack_id) on delete set null
);

create index idx_orders_status on tb_donate_orders(status);
create index idx_orders_user_id on tb_donate_orders(user_id);
create index idx_orders_created_at on tb_donate_orders(created_at);
create index idx_orders_ticket_channel_id on tb_donate_orders(ticket_channel_id);
create index ix_orders_pack_id on tb_donate_orders(pack_id);

create trigger trg_tb_donate_orders_updated
before update on tb_donate_orders
for each row execute function set_updated_at();

create table tb_donate_vehicles (
  id bigserial primary key,
  guild_id varchar(32) not null,
  plate varchar(20) not null,
  kind varchar(10) not null check (kind in ('CAR','BOAT')),
  model varchar(100) not null,
  owner_user_id varchar(32) not null,
  owner_tag varchar(100) not null,
  order_no varchar(20) references tb_donate_orders(order_no) on delete set null,
  active boolean not null default true,
  registered_at timestamptz not null default now(),
  registered_by varchar(32),
  plate_card_message_id varchar(32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_vehicles_plate unique (plate)
);

create index idx_vehicles_owner on tb_donate_vehicles(owner_user_id);
create index idx_vehicles_kind on tb_donate_vehicles(kind);
create index idx_vehicles_plate_card_message_id on tb_donate_vehicles(plate_card_message_id);

create trigger trg_tb_donate_vehicles_updated
before update on tb_donate_vehicles
for each row execute function set_updated_at();

create table tb_donate_vehicle_insurance (
  id bigserial primary key,
  plate varchar(20) not null references tb_donate_vehicles(plate) on delete cascade,
  kind varchar(10) not null check (kind in ('CAR','BOAT')),
  total integer not null default 0 check (total >= 0),
  used integer not null default 0 check (used >= 0),
  expire_at timestamptz,
  order_no varchar(20) references tb_donate_orders(order_no) on delete set null,
  source varchar(30) not null default 'DONATE_PACK' check (source in ('DONATE_PACK','VIP','MANUAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_vehicle_insurance_plate_kind unique (plate, kind),
  constraint chk_insurance_used_le_total check (used <= total)
);

create index idx_vehicle_insurance_expire on tb_donate_vehicle_insurance(expire_at);
create index idx_vehicle_insurance_plate on tb_donate_vehicle_insurance(plate);
create index idx_vehicle_insurance_plate_kind on tb_donate_vehicle_insurance(plate, kind);

create trigger trg_tb_donate_vehicle_insurance_updated
before update on tb_donate_vehicle_insurance
for each row execute function set_updated_at();

create table tb_donate_insurance_logs (
  id bigserial primary key,
  guild_id varchar(32),
  plate varchar(20),
  kind varchar(10),
  user_id varchar(32),
  staff_id varchar(32),
  action varchar(50),
  created_at timestamptz not null default now(),
  delta integer,
  order_no varchar(20),
  note text
);

create index idx_insurance_logs_plate on tb_donate_insurance_logs(plate);
create index idx_insurance_logs_created on tb_donate_insurance_logs(created_at);

create table tb_donate_vip_subscriptions (
  id bigserial primary key,
  guild_id varchar(32) not null,
  user_id varchar(32) not null,
  user_tag varchar(100),
  vip_code varchar(50) not null,
  role_id varchar(32) not null,
  active boolean not null default true,
  start_at timestamptz not null default now(),
  expire_at timestamptz not null,
  next_grant_at timestamptz not null,
  last_grant_at timestamptz,
  warned_24h boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ux_vip_subs_guild_user_code unique (guild_id, user_id, vip_code)
);

create index idx_vip_active on tb_donate_vip_subscriptions(active);
create index idx_vip_next_grant on tb_donate_vip_subscriptions(next_grant_at);
create index idx_vip_expire on tb_donate_vip_subscriptions(expire_at);
create index idx_vip_user_id on tb_donate_vip_subscriptions(user_id);

create trigger trg_tb_donate_vip_subscriptions_updated
before update on tb_donate_vip_subscriptions
for each row execute function set_updated_at();

create table boost_claims (
  id bigserial primary key,
  ign varchar(100) not null,
  boost_code varchar(50) not null,
  order_no varchar(20) not null unique references tb_donate_orders(order_no) on delete cascade,
  user_id varchar(32),
  created_at timestamptz not null default now(),
  constraint uq_boost_once_per_ign unique (ign, boost_code)
);

create index idx_boost_claims_ign on boost_claims(ign);

create table tb_donate_totals (
  id bigserial primary key,
  date date not null,
  guild_id varchar(32) not null,
  donate_amount integer not null default 0,
  cases integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint donate_totals_date_key unique (date, guild_id)
);

create index idx_donate_totals_day on tb_donate_totals(date);

create trigger trg_tb_donate_pack_master_updated
before update on tb_donate_pack_master
for each row execute function set_updated_at();

commit;
