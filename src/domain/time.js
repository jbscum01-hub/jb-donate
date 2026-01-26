export function yyyymmdd(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function formatDateTime(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return d.toISOString().replace('T',' ').slice(0,16) + " UTC";
}
