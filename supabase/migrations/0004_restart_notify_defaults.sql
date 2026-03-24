BEGIN;

INSERT INTO public.tb_donate_discord_config (scope_type, scope_key, config_key, config_value, display_name, is_active)
VALUES
('GLOBAL', 'SYSTEM', 'RESTART_NOTIFY_CHANNEL_ID', '', 'Restart Notify Channel', true),
('GLOBAL', 'SYSTEM', 'RESTART_SCHEDULE_HOURS', '0,3,6,9,12,15,18,21', 'Restart Schedule Hours', true),
('GLOBAL', 'SYSTEM', 'RESTART_NOTIFY_MINUTES', '60,30,5,2,1', 'Restart Notify Minutes', true)
ON CONFLICT (scope_type, scope_key, config_key)
DO NOTHING;

COMMIT;
