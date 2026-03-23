create table if not exists tb_donate_shop_panel_map (
  panel_id uuid primary key default gen_random_uuid(),
  channel_id varchar(32) not null,
  panel_key varchar(120) not null,
  pack_id uuid references tb_donate_pack_master(pack_id) on delete cascade,
  pack_code varchar(50),
  message_id varchar(32) not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, panel_key)
);

create index if not exists ix_tb_donate_shop_panel_map_channel_sort
  on tb_donate_shop_panel_map(channel_id, is_active, sort_order);
