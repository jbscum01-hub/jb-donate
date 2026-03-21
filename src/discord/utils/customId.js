export function extractOrderNoFromCustomId(customId = "") {
  if (!customId || typeof customId !== "string") return null;

  const parts = customId.split(":");

  // New style: staff:approve:JB-20260321-0001
  if (parts[0] === "staff" && parts.length >= 3) {
    return parts.slice(2).join(":") || null;
  }

  // Ticket select: ticket_model_select:JB-20260321-0001
  if (parts[0] === "ticket_model_select" && parts.length >= 2) {
    return parts.slice(1).join(":") || null;
  }

  // Plate modal: set_plate_modal:CAR:JB-20260321-0001
  if (parts[0] === "set_plate_modal" && parts.length >= 3) {
    return parts.slice(2).join(":") || null;
  }

  // Legacy underscore style: staff_approve:JB-20260321-0001
  const idx = customId.indexOf(":");
  if (idx !== -1) {
    const tail = customId.slice(idx + 1).trim();
    return tail || null;
  }

  return null;
}

export function isStaffActionId(customId = "", action = "") {
  return customId === `staff:${action}` ||
    customId.startsWith(`staff:${action}:`) ||
    customId.startsWith(`staff_${action}:`);
}
