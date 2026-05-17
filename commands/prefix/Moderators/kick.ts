import { Message, PermissionFlagsBits } from 'discord.js';
import configManager from '../../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../../utils/cooldown';
import { hasModAccess } from '../../../utils/permissions';
import { canModerateTarget } from '../../../utils/canModerateTarget';
import { MESSAGES } from '../../../utils/messages';

export default {
  name: 'kick',
  description: 'Kicks a user from the server.',
  requiredUserPermissions: [PermissionFlagsBits.KickMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply({
        content: MESSAGES.common.botMissingPermission('Kick Members'),
        allowedMentions: { parse: [] }
      });
    }
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.KickMembers]
    );

    if (!hasPermission) {
      return message.reply({
        content: MESSAGES.common.noPermission,
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('kick', message.author.id, message.guild?.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: MESSAGES.common.cooldownWait(seconds),
        allowedMentions: { parse: [] }
      });
    }
    if (message.guild) setCooldown('kick', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: MESSAGES.moderation.usage.kick,
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
        return message.reply({ content: MESSAGES.moderation.cannotActionMods('kick'), allowedMentions: { parse: [] } });
      }

      if (message.member) {
        const guard = canModerateTarget(message.member, member, message.guild);
        if (!guard.ok) {
          return message.reply({ content: guard.reason, allowedMentions: { parse: [] } });
        }
      }

      try {
        await member.send(MESSAGES.moderation.dm.kicked(message.guild.name, reason));
      } catch {}

      await member.kick(reason);

      await message.reply({
        content: MESSAGES.moderation.reply.kicked(userId),
        allowedMentions: { parse: [] }
      });

      const logChannelId = config.logging.logChannelId || '';
      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (logChannel && logChannel.isTextBased()) {
        logChannel.send({
          content: MESSAGES.moderation.log.kick(userId, message.author.id, reason),
          allowedMentions: { parse: [] }
        });
      }

    } catch (error) {
      console.error(error);
      message.reply({
        content: MESSAGES.moderation.errors.kickFailed,
        allowedMentions: { parse: [] }
      });
    }
  }
};


