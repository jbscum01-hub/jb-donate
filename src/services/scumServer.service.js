function normalizeString(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

export async function getScumServerStatus(serverId) {
  const normalizedServerId = String(serverId ?? '').trim();
  if (!normalizedServerId) return null;

  const url = `https://api.battlemetrics.com/servers/${encodeURIComponent(normalizedServerId)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'jb-donate-bot/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`BattleMetrics HTTP ${response.status}`);
    }

    const payload = await response.json();
    const attributes = payload?.data?.attributes ?? {};
    const details = attributes?.details ?? {};

    const ip = pickFirst(details.ip, details.serverIP, details.address, attributes.ip);
    const port = pickFirst(details.port, details.gamePort, attributes.port);
    const map = pickFirst(details.map, details.level, details.world, details.raw?.map);
    const country = pickFirst(details.country, details.location);
    const version = pickFirst(details.version, details.raw?.version);
    const rank = pickFirst(attributes.rank, details.rank);

    return {
      id: normalizedServerId,
      name: normalizeString(attributes.name, 'SCUM Server'),
      status: normalizeString(attributes.status, 'unknown').toLowerCase(),
      players: normalizeNumber(attributes.players, 0),
      maxPlayers: normalizeNumber(attributes.maxPlayers, 0),
      queue: normalizeNumber(attributes?.details?.rust_queued_players ?? details.queue ?? details.queuedPlayers, 0),
      map: normalizeString(map, 'Unknown'),
      ip: normalizeString(ip, '-'),
      port: normalizeString(port, '-'),
      country: normalizeString(country, '-'),
      version: normalizeString(version, '-'),
      rank: rank == null || String(rank).trim() === '' ? '-' : String(rank).trim(),
      raw: payload,
    };
  } catch (error) {
    console.error('SCUM server status fetch failed:', error?.message || error);
    return null;
  }
}
