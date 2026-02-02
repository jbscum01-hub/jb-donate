export function isSteamId17(s) {
  return /^[0-9]{17}$/.test(String(s ?? "").trim());
}

// src/domain/validators.js
export function isPlate6(v) {
  return String(v || "").trim().length > 0;
}


export function safeSlugUsername(name) {
  return String(name ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 18) || "user";
}
