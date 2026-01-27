import { isAdmin } from "../../domain/permissions.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";
import { IDS } from "../../config/constants.js";
import { safeReply } from "../utils/messages.js";

// Router expects a handler named `useInsuranceFromCard`.
// Keep the more descriptive name too (backward compatible).
export async function useInsuranceFromCard(interaction) {
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }

  const [_, plate, kind] = interaction.customId.split(":");
  const vehicle = await VehiclesRepo.getByPlate(plate);
  if (!vehicle) return safeReply(interaction, { content: "❌ ไม่พบทะเบียนในระบบ", ephemeral: true });

  const updated = await InsuranceRepo.useOnce(plate, kind);
  if (!updated) {
    return safeReply(interaction, { content: "❌ ใช้ประกันไม่ได้ (หมดอายุ/หมดจำนวน/ไม่มีประกัน)", ephemeral: true });
  }

  await InsuranceRepo.log({
    guild_id: interaction.guildId,
    plate, kind,
    action: "USE",
    delta: -1,
    order_no: vehicle.order_no ?? null,
    user_id: vehicle.owner_user_id,
    staff_id: interaction.user.id,
    note: "use from vehicle card",
  });

  // Update card message (edit itself)
  const insurance = await InsuranceRepo.getInsurance(plate, kind);
  const payload = buildVehicleCard({
    plate,
    kind,
    model: vehicle.model,
    ownerUserId: vehicle.owner_user_id,
    ownerTag: vehicle.owner_tag,
    insurance,
  });

  await interaction.message.edit(payload).catch(()=>{});

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "INSURANCE_USE",
    target: plate,
    meta: { kind },
  });

  // DM owner (best effort)
  const remain = Math.max(insurance.total - insurance.used, 0);
  try {
    const u = await interaction.client.users.fetch(vehicle.owner_user_id);
    await u.send(`🛡️ ใช้ประกัน ${kind} ของทะเบียน ${plate} แล้ว\nเหลือ: ${remain}/${insurance.total}\nหมดอายุ: ${insurance.expire_at}`);
  } catch {}

  return safeReply(interaction, { content: `✅ ใช้ประกันสำเร็จ (ทะเบียน ${plate})`, ephemeral: true });
}

// Backward compatible named export (in case other files import the old name)
export async function useInsuranceFromVehicleCard(interaction) {
  return useInsuranceFromCard(interaction);
}
