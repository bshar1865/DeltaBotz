import { Message, TextChannel, PermissionFlagsBits } from 'discord.js';
import configManager from '../../../utils/ConfigManager';
import { hasModAccess } from '../../../utils/permissions';
import { canModerateTarget } from '../../../utils/canModerateTarget';
import { MESSAGES } from '../../../utils/messages';

export default {
  name: 'warn',
  description: 'Warns a user in the server.',
  requiredUserPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({
        content: MESSAGES.common.botMissingPermission('Moderate Members'),
        allowedMentions: { parse: [] }
      });
    }
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.ModerateMembers]
    );

    if (!hasPermission) {
      return message.reply({
        content: MESSAGES.common.noPermission,
        allowedMentions: { parse: [] }
      });
    }

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: MESSAGES.moderation.usage.warn,
        allowedMentions: { parse: [] }
      });
    }

    const reason = args.slice(1).join(' ') || MESSAGES.moderation.defaultReason;

    try {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply({
          content: MESSAGES.moderation.targetNotFound,
          allowedMentions: { parse: [] }
        });
      }

      if (member.roles.cache.some(role => (config.permissions.moderatorRoles || []).includes(role.id))) {
        return message.reply({ content: MESSAGES.moderation.cannotActionMods('warn'), allowedMentions: { parse: [] } });
      }

      if (message.member) {
        const guard = canModerateTarget(message.member, member, message.guild);
        if (!guard.ok) {
          return message.reply({ content: guard.reason, allowedMentions: { parse: [] } });
        }
      }

      await message.reply({ content: MESSAGES.moderation.reply.warned(userId), allowedMentions: { parse: [] } });

      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
      if (logChannel && config.logging.events.warn) {
        logChannel.send({
          content: MESSAGES.moderation.log.warn(userId, message.author.id, reason),
          allowedMentions: { parse: [] }
        });
      }

      member.send(MESSAGES.moderation.dm.warned(message.guild?.name || 'this server', reason))
        .catch(() => {});

    } catch (error) {
      console.error(error);
      message.reply({
        content: MESSAGES.moderation.errors.warnFailed,
        allowedMentions: { parse: [] }
      });
    }
  }
};


