BEGIN;

ALTER TABLE IF EXISTS public.tb_donate_discord_config
  DROP CONSTRAINT IF EXISTS tb_donate_discord_config_scope_type_key;
ALTER TABLE IF EXISTS public.tb_donate_discord_config
  DROP CONSTRAINT IF EXISTS tb_donate_discord_config_scope_key_key;
ALTER TABLE IF EXISTS public.tb_donate_discord_config
  DROP CONSTRAINT IF EXISTS tb_donate_discord_config_config_key_key;
ALTER TABLE IF EXISTS public.tb_donate_discord_config
  DROP CONSTRAINT IF EXISTS ux_tb_shop_discord_config_scope;

ALTER TABLE IF EXISTS public.tb_donate_discord_config
  ADD CONSTRAINT ux_tb_shop_discord_config_scope
  UNIQUE (scope_type, scope_key, config_key);

COMMIT;
