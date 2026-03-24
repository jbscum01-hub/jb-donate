BEGIN;

INSERT INTO public.tb_donate_discord_config (scope_type, scope_key, config_key, config_value, display_name, is_active)
VALUES
('GLOBAL', 'SYSTEM', 'ANNOUNCE_ENABLED', 'false', 'Announce Enabled', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_AUTO_ENABLED', 'true', 'Auto Announce Enabled', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_ADMIN_COMMAND_ENABLED', 'true', 'Admin Announce Command Enabled', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_ECHO_TO_CHANNEL_ENABLED', 'true', 'Announce Echo To Channel Enabled', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_RCON_HOST', '', 'Announce RCON Host', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_RCON_PORT', '0', 'Announce RCON Port', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_RCON_PASSWORD', '', 'Announce RCON Password', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_RCON_LOGIN_DELAY_MS', '350', 'Announce RCON Login Delay Ms', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_RCON_SEND_DELAY_MS', '350', 'Announce RCON Send Delay Ms', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_RCON_CLOSE_DELAY_MS', '1000', 'Announce RCON Close Delay Ms', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_RCON_COMMAND_PREFIX', '#announce', 'Announce RCON Command Prefix', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_ADMIN_COMMAND_PREFIX', '!announce', 'Admin Announce Command Prefix', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_MESSAGE_30', '⏰ เซิร์ฟเวอร์จะรีในอีก 30 นาที', 'Announce Message 30 Minutes', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_MESSAGE_5', '⏰ เซิร์ฟเวอร์จะรีในอีก 5 นาที', 'Announce Message 5 Minutes', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_MESSAGE_2', '⏰ เซิร์ฟเวอร์จะรีในอีก 2 นาที', 'Announce Message 2 Minutes', true),
('GLOBAL', 'SYSTEM', 'ANNOUNCE_MESSAGE_1', '⏰ เซิร์ฟเวอร์จะรีในอีก 1 นาที', 'Announce Message 1 Minute', true)
ON CONFLICT (scope_type, scope_key, config_key)
DO NOTHING;

COMMIT;
