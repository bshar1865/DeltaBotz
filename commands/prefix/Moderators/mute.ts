import { Message, PermissionFlagsBits, TextChannel } from 'discord.js';
import configManager from '../../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../../utils/cooldown';
import { hasModAccess } from '../../../utils/permissions';
import { canModerateTarget } from '../../../utils/canModerateTarget';
import { MESSAGES } from '../../../utils/messages';

export default {
  name: 'mute',
  description: 'Times out a user for a specified duration.',
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

    const remaining = getCooldownRemaining('mute', message.author.id, message.guild.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: MESSAGES.common.cooldownWait(seconds),
        allowedMentions: { parse: [] }
      });
    }
    setCooldown('mute', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({ content: MESSAGES.moderation.usage.muteUser, allowedMentions: { parse: [] } });
    }

    const duration = args[1];
    if (!duration) {
      return message.reply({ content: MESSAGES.moderation.usage.muteDuration, allowedMentions: { parse: [] } });
    }

    const reason = args.slice(2).join(' ') || MESSAGES.moderation.defaultReason;

    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      return message.reply({ content: MESSAGES.moderation.usage.muteBadDuration, allowedMentions: { parse: [] } });
    }

    const amount = parseInt(match[1]);
    const unit = match[2];
    const durationMs = unit === 's' ? amount * 1000 : unit === 'm' ? amount * 60000 : unit === 'h' ? amount * 3600000 : amount * 86400000;

    const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000; // Discord timeout limit (28 days)
    if (durationMs > maxTimeoutMs) {
      return message.reply({ content: MESSAGES.moderation.usage.muteTooLong, allowedMentions: { parse: [] } });
    }

    try {
      const member = await message.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return message.reply({ content: MESSAGES.moderation.targetNotFound, allowedMentions: { parse: [] } });
      }

      if (member.roles.cache.some(role => (config.permissions.moderatorRoles || []).includes(role.id))) {
        return message.reply({ content: MESSAGES.moderation.cannotActionMods('mute'), allowedMentions: { parse: [] } });
      }

      if (message.member) {
        const guard = canModerateTarget(message.member, member, message.guild);
        if (!guard.ok) {
          return message.reply({ content: guard.reason, allowedMentions: { parse: [] } });
        }
      }

      await member.timeout(durationMs, reason);

      await message.reply({ content: MESSAGES.moderation.reply.muted(userId, duration, reason), allowedMentions: { parse: [] } });

      const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
      if (logChannel?.type === 0) {
        logChannel.send({
          content: MESSAGES.moderation.log.mute(userId, message.author.id, duration, reason),
          allowedMentions: { parse: [] }
        });
      }

      try {
        await member.send(MESSAGES.moderation.dm.muted(message.guild?.name || 'this server', duration, reason));
      } catch {}

      setTimeout(async () => {
        try {
          await member.send(MESSAGES.moderation.dm.muteEnded(message.guild?.name || 'this server'));
        } catch {}
        if (logChannel?.type === 0) {
          logChannel.send({
            content: MESSAGES.moderation.reply.unmutedLog(userId, message.author.id),
            allowedMentions: { parse: [] }
          }).catch(() => {});
        }
      }, durationMs);

    } catch (error) {
      console.error(error);
      message.reply({ content: MESSAGES.moderation.errors.muteFailed, allowedMentions: { parse: [] } });
    }
  }
};

