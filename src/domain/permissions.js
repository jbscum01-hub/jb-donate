import { IDS } from "../config/constants.js";

export function isAdmin(member) {
  const roleId = IDS.ADMIN_ROLE_ID;
  return Boolean(roleId && member?.roles?.cache?.has(roleId));
}
