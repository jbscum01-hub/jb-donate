import { ChannelType, PermissionsBitField } from "discord.js";
import { IDS } from "../../config/constants.js";

export async function createTicketChannel(guild, user, name) {
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ],
    },
    {
      id: IDS.ADMIN_ROLE_ID,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages,
      ],
    },
  ];

  const ch = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: IDS.TICKET_CATEGORY_ID,
    permissionOverwrites: overwrites,
  });

  return ch;
}
