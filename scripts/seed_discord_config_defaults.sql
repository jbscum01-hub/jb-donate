BEGIN;

INSERT INTO public.tb_donate_discord_config (scope_type, scope_key, config_key, config_value, display_name, is_active)
VALUES
('GLOBAL', 'SYSTEM', 'SHOP_CHANNEL_ID', '', 'Shop Channel', true),
('GLOBAL', 'SYSTEM', 'PANEL_MESSAGE_ID', '', 'Shop Panel Message', true),
('GLOBAL', 'SYSTEM', 'ADMIN_DASHBOARD_CHANNEL_ID', '', 'Admin Dashboard Channel', true),
('GLOBAL', 'SYSTEM', 'ADMIN_DASHBOARD_MESSAGE_ID', '', 'Admin Dashboard Message', true)
ON CONFLICT (scope_type, scope_key, config_key)
DO NOTHING;

COMMIT;
