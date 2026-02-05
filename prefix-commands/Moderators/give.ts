import { Message } from 'discord.js';
import idclass from '../../utils/idclass';
import configManager from '../../utils/ConfigManager';

export default {
  name: 'giver',
  description: 'Gives specified roles to a mentioned user or by user ID.',

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const requiredRoles = config.permissions.moderatorRoles || [];
    const memberRoles = message.member?.roles?.cache;

    const isOwner = message.author.id === config.permissions.ownerId || message.author.id === idclass.ownershipID();
    const hasRequiredRole = isOwner || (memberRoles && memberRoles.some((role: { id: string; }) => requiredRoles.includes(role.id)));

    if (!hasRequiredRole) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    if (args.length < 2) {
      return message.reply({
        content: 'Usage: `giver <@user|userID> <roleID1> [roleID2 ...]`',
        allowedMentions: { parse: [] }
      });
    }

    const userId = (args[0] as string).replace(/[<@!>]/g, '');
    const targetMember = await message.guild.members.fetch(userId).catch(() => null);
    if (!targetMember) {
      return message.reply({
        content: 'Could not find the specified user.',
        allowedMentions: { parse: [] }
      });
    }

    const roleIds = args.slice(1);
    const validRoles = [];
    const rejectedRoles = [];

    for (const roleId of roleIds) {
      const role = message.guild.roles.cache.get(roleId);
      if (!role || requiredRoles.includes(role.id)) {
        rejectedRoles.push(roleId);
      } else {
        validRoles.push(role);
      }
    }

    try {
      if (validRoles.length > 0) {
        await targetMember.roles.add(validRoles.map(r => r.id));
        await message.reply({
          content: `Added roles to <@${targetMember.id}>: ${validRoles.map(r => r.name).join(', ')}`,
          allowedMentions: { parse: [] }
        });

        const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
        if (logChannel?.isTextBased()) {
          logChannel.send({
            content: `Action: Give Role\nUser: <@${targetMember.id}>\nBy: <@${message.author.id}>\nRoles: ${validRoles.map(r => r.name).join(', ')}`,
            allowedMentions: { parse: [] }
          });
        }
      } else {
        await message.reply({
          content: 'No valid roles to add.',
          allowedMentions: { parse: [] }
        });
      }

      if (rejectedRoles.length > 0) {
        await message.reply({
          content: `Invalid or restricted role IDs: ${rejectedRoles.join(', ')}`,
          allowedMentions: { parse: [] }
        });
      }
    } catch (err) {
      console.error(err);
      await message.reply({
        content: 'An error occurred while assigning roles.',
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
      if (logChannel?.isTextBased()) {
        logChannel.send({
          content: `Action: Give Role (Error)\nUser: <@${targetMember.id}>\nBy: <@${message.author.id}>`,
          allowedMentions: { parse: [] }
        });
      }
    }
  }
};
