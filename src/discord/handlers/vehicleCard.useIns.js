import { MessageFlags } from "discord.js";
import { isAdmin } from "../../domain/permissions.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";
import { safeReply } from "../utils/messages.js";

export async function useInsuranceFromCard(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    if (!isAdmin(interaction.member)) {
      return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
    }

    const [, plate, kind] = interaction.customId.split(":");
    if (!plate || !kind) {
      return safeReply(interaction, { content: "❌ ข้อมูลทะเบียนหรือประเภทไม่ถูกต้อง", ephemeral: true });
    }

    const vehicle = await VehiclesRepo.getByPlate(plate);
    if (!vehicle) return safeReply(interaction, { content: "❌ ไม่พบทะเบียนในระบบ", ephemeral: true });

    const updated = await InsuranceRepo.useOnce(plate, kind);
    if (!updated) {
      return safeReply(interaction, { content: "❌ ใช้ประกันไม่ได้ (หมดอายุ/หมดจำนวน/ไม่มีประกัน)", ephemeral: true });
    }

    await InsuranceRepo.log({
      guildId: interaction.guildId,
      plate,
      kind,
      action: "USE",
      delta: -1,
      order_no: vehicle.order_no ?? null,
      user_id: vehicle.owner_user_id,
      staff_id: interaction.user.id,
      note: "use from vehicle card",
    });

    const insurance = await InsuranceRepo.getInsurance(plate, kind);
    const payload = buildVehicleCard({
      plate,
      kind,
      model: vehicle.model,
      ownerUserId: vehicle.owner_user_id,
      ownerTag: vehicle.owner_tag,
      insurance,
    });

    await interaction.message.edit(payload).catch(() => {});

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      action: "INSURANCE_USE",
      target: plate,
      meta: { kind },
    });

    const remain = Math.max((insurance?.total ?? 0) - (insurance?.used ?? 0), 0);
    try {
      const u = await interaction.client.users.fetch(vehicle.owner_user_id);
      await u.send(`🛡️ ใช้ประกัน ${kind} ของทะเบียน ${plate} แล้ว\nเหลือ: ${remain}/${insurance?.total ?? 0}\nหมดอายุ: ${insurance?.expire_at ?? "-"}`);
    } catch {}

    return safeReply(interaction, { content: `✅ ใช้ประกันสำเร็จ (ทะเบียน ${plate})`, ephemeral: true });
  } catch (error) {
    console.error("useInsuranceFromCard error", error);
    return safeReply(interaction, { content: `❌ ใช้ประกันไม่สำเร็จ: ${error?.message || String(error)}`, ephemeral: true }).catch(() => {});
  }
}

export async function useInsuranceFromVehicleCard(interaction) {
  return useInsuranceFromCard(interaction);
}
