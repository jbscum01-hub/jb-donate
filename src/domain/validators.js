export function isSteamId17(s) {
  return /^[0-9]{17}$/.test(String(s ?? "").trim());
}

export function isPlate6(s) {
  return /^[0-9]{6}$/.test(String(s ?? "").trim());
}

export function safeSlugUsername(name) {
  return String(name ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 18) || "user";
}
