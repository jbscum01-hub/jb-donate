import { IDS } from "../config/constants.js";

export function isAdmin(member) {
  return Boolean(member?.roles?.cache?.has(IDS.ADMIN_ROLE_ID));
}
