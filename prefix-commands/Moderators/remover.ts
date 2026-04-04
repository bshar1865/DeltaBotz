import { Message, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { hasModAccess } from '../../utils/permissions';

export default {
  name: 'remover',
  description: 'Removes specified roles from a mentioned user or by user ID.',
  requiredUserPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.ManageRoles]
    );

    if (!hasPermission) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    if (args.length < 2) {
      return message.reply({
        content: 'Usage: `remover <@user|userID> <roleID1> [roleID2 ...]`',
        allowedMentions: { parse: [] }
      });
    }

    const userId = (args[0] as string).replace(/[<@!>]/g, '');
    const targetMember = await message.guild.members.fetch(userId).catch(() => null);
    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply({
        content: 'I need Manage Roles permission to do that.',
        allowedMentions: { parse: [] }
      });
    }
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
      if (!role || (config.permissions.moderatorRoles || []).includes(role.id)) {
        rejectedRoles.push(roleId);
      } else {
        validRoles.push(role);
      }
    }

    try {
      if (validRoles.length > 0) {
        await targetMember.roles.remove(validRoles.map(r => r.id));
        await message.reply({
          content: `Removed roles from <@${targetMember.id}>: ${validRoles.map(r => r.name).join(', ')}`,
          allowedMentions: { parse: [] }
        });

        const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
        if (logChannel?.isTextBased()) {
          logChannel.send({
            content: `Action: Remove Role\nUser: <@${targetMember.id}>\nBy: <@${message.author.id}>\nRoles: ${validRoles.map(r => r.name).join(', ')}`,
            allowedMentions: { parse: [] }
          });
        }
      } else {
        await message.reply({
          content: 'No valid roles to remove.',
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
        content: 'An error occurred while removing roles.',
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
      if (logChannel?.isTextBased()) {
        logChannel.send({
          content: `Action: Remove Role (Error)\nUser: <@${targetMember.id}>\nBy: <@${message.author.id}>`,
          allowedMentions: { parse: [] }
        });
      }
    }
  }
};

