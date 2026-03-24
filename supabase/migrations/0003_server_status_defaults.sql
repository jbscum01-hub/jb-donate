BEGIN;

INSERT INTO public.tb_donate_discord_config (scope_type, scope_key, config_key, config_value, display_name, is_active)
VALUES
('GLOBAL', 'SYSTEM', 'BATTLEMETRICS_SERVER_ID', '', 'BattleMetrics Server ID', true),
('GLOBAL', 'SYSTEM', 'SERVER_STATUS_CHANNEL_ID', '', 'Server Status Channel', true),
('GLOBAL', 'SYSTEM', 'SERVER_STATUS_MESSAGE_ID', '', 'Server Status Message', true),
('GLOBAL', 'SYSTEM', 'SERVER_STATUS_REFRESH_SECONDS', '60', 'Server Status Refresh Seconds', true),
('GLOBAL', 'SYSTEM', 'SERVER_STATUS_GIF_ONLINE', '', 'Server Status GIF Online', true),
('GLOBAL', 'SYSTEM', 'SERVER_STATUS_GIF_OFFLINE', '', 'Server Status GIF Offline', true)
ON CONFLICT (scope_type, scope_key, config_key)
DO NOTHING;

COMMIT;
