import net from 'net';
import { IDS } from '../config/constants.js';

function isTruthy(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function toInt(value, fallback) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

function sanitizeMessage(message) {
  return String(message ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function maskHost(host) {
  if (!host) return '';
  const s = String(host).trim();
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

export function getAnnounceRuntime() {
  const enabled = isTruthy(IDS.ANNOUNCE_ENABLED, false);
  const autoEnabled = isTruthy(IDS.ANNOUNCE_AUTO_ENABLED, true);
  const adminCommandEnabled = isTruthy(IDS.ANNOUNCE_ADMIN_COMMAND_ENABLED, true);
  const echoToChannel = isTruthy(IDS.ANNOUNCE_ECHO_TO_CHANNEL_ENABLED, true);
  const host = String(IDS.ANNOUNCE_RCON_HOST || '').trim();
  const port = toInt(IDS.ANNOUNCE_RCON_PORT, 0);
  const password = String(IDS.ANNOUNCE_RCON_PASSWORD || '').trim();
  const loginDelayMs = toInt(IDS.ANNOUNCE_RCON_LOGIN_DELAY_MS, 350);
  const sendDelayMs = toInt(IDS.ANNOUNCE_RCON_SEND_DELAY_MS, 350);
  const closeDelayMs = toInt(IDS.ANNOUNCE_RCON_CLOSE_DELAY_MS, 1000);
  const commandPrefix = String(IDS.ANNOUNCE_RCON_COMMAND_PREFIX || '#announce').trim() || '#announce';
  const adminPrefix = String(IDS.ANNOUNCE_ADMIN_COMMAND_PREFIX || '!announce').trim() || '!announce';

  return {
    enabled,
    autoEnabled,
    adminCommandEnabled,
    echoToChannel,
    host,
    port,
    password,
    loginDelayMs,
    sendDelayMs,
    closeDelayMs,
    commandPrefix,
    adminPrefix,
    ready: Boolean(enabled && host && port && password),
  };
}

export function getAutoRestartMessage(minutesLeft) {
  const key = `ANNOUNCE_MESSAGE_${minutesLeft}`;
  const fallback = `⏰ เซิร์ฟเวอร์จะรีในอีก ${minutesLeft} นาที`;
  return sanitizeMessage(IDS[key] || fallback);
}

export async function sendRconAnnouncement(message, { source = 'unknown' } = {}) {
  const runtime = getAnnounceRuntime();
  const text = sanitizeMessage(message);

  if (!runtime.enabled) {
    return { ok: false, skipped: true, reason: 'announce_disabled', source };
  }

  if (!text) {
    return { ok: false, skipped: true, reason: 'empty_message', source };
  }

  if (!runtime.ready) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_rcon_config',
      source,
      host: maskHost(runtime.host),
      port: runtime.port || null,
    };
  }

  const command = `${runtime.commandPrefix} ${text}`;

  return new Promise((resolve) => {
    let resolved = false;
    const socket = new net.Socket();

    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      try {
        socket.destroy();
      } catch {}
      resolve(payload);
    };

    socket.setTimeout(8000);

    socket.on('connect', () => {
      socket.write(`${runtime.password}\n`);
      setTimeout(() => {
        socket.write(`${command}\n`);
      }, runtime.loginDelayMs);
      setTimeout(() => {
        finish({ ok: true, skipped: false, source, host: maskHost(runtime.host), port: runtime.port, command: runtime.commandPrefix, message: text });
      }, runtime.loginDelayMs + runtime.sendDelayMs + runtime.closeDelayMs);
    });

    socket.on('timeout', () => finish({ ok: false, skipped: false, reason: 'timeout', source }));
    socket.on('error', (error) => finish({ ok: false, skipped: false, reason: 'socket_error', source, error: error?.message || String(error) }));
    socket.on('close', () => {
      if (!resolved) {
        finish({ ok: true, skipped: false, source, host: maskHost(runtime.host), port: runtime.port, command: runtime.commandPrefix, message: text, closed: true });
      }
    });

    try {
      socket.connect(runtime.port, runtime.host);
    } catch (error) {
      finish({ ok: false, skipped: false, reason: 'connect_throw', source, error: error?.message || String(error) });
    }
  });
}
