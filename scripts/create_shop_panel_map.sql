BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_donate_shop_panel_map (
  panel_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id varchar(32) NOT NULL,
  panel_key varchar(120) NOT NULL,
  pack_id uuid REFERENCES public.tb_donate_pack_master(pack_id) ON DELETE CASCADE,
  pack_code varchar(50),
  message_id varchar(32) NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, panel_key)
);

CREATE INDEX IF NOT EXISTS ix_tb_donate_shop_panel_map_channel_sort
  ON public.tb_donate_shop_panel_map(channel_id, is_active, sort_order);

COMMIT;
