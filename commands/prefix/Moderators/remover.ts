import { Message, PermissionFlagsBits } from 'discord.js';
import configManager from '../../../utils/ConfigManager';
import { hasModAccess } from '../../../utils/permissions';
import { canModerateTarget } from '../../../utils/canModerateTarget';
import { MESSAGES } from '../../../utils/messages';

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
        content: MESSAGES.common.noPermission,
        allowedMentions: { parse: [] }
      });
    }

    if (args.length < 2) {
      return message.reply({
        content: MESSAGES.moderation.usage.remover,
        allowedMentions: { parse: [] }
      });
    }

    const userId = (args[0] as string).replace(/[<@!>]/g, '');
    const targetMember = await message.guild.members.fetch(userId).catch(() => null);
    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply({
        content: MESSAGES.common.botMissingPermission('Manage Roles'),
        allowedMentions: { parse: [] }
      });
    }
    if (!targetMember) {
      return message.reply({
        content: MESSAGES.roles.targetNotFound,
        allowedMentions: { parse: [] }
      });
    }

    if (message.member) {
      const guard = canModerateTarget(message.member, targetMember, message.guild);
      if (!guard.ok) {
        return message.reply({ content: guard.reason, allowedMentions: { parse: [] } });
      }
    }

    const roleIds = args.slice(1);
    const validRoles = [];
    const rejectedRoles = [];

    const isGuildOwner = message.author.id === message.guild.ownerId;

    for (const roleId of roleIds) {
      const role = message.guild.roles.cache.get(roleId);
      if (
        !role ||
        role.id === message.guild.id ||
        role.managed ||
        (config.permissions.moderatorRoles || []).includes(role.id) ||
        (!isGuildOwner && message.member && role.comparePositionTo(message.member.roles.highest) >= 0) ||
        !role.editable
      ) {
        rejectedRoles.push(roleId);
      } else {
        validRoles.push(role);
      }
    }

    try {
      if (validRoles.length > 0) {
        await targetMember.roles.remove(validRoles.map(r => r.id));
        await message.reply({
          content: MESSAGES.roles.removedRoles(targetMember.id, validRoles.map(r => r.name)),
          allowedMentions: { parse: [] }
        });

        const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
        if (logChannel?.isTextBased()) {
          logChannel.send({
            content: MESSAGES.roles.logRemoveRole(targetMember.id, message.author.id, validRoles.map(r => r.name)),
            allowedMentions: { parse: [] }
          });
        }
      } else {
        await message.reply({
          content: MESSAGES.roles.noValidRolesToRemove,
          allowedMentions: { parse: [] }
        });
      }

      if (rejectedRoles.length > 0) {
        await message.reply({
          content: MESSAGES.roles.invalidOrRestrictedRoleIds(rejectedRoles),
          allowedMentions: { parse: [] }
        });
      }
    } catch (err) {
      console.error(err);
      await message.reply({
        content: MESSAGES.roles.removeError,
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
      if (logChannel?.isTextBased()) {
        logChannel.send({
          content: MESSAGES.roles.logRemoveRoleError(targetMember.id, message.author.id),
          allowedMentions: { parse: [] }
        });
      }
    }
  }
};

