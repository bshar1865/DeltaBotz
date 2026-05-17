import { Message, PermissionFlagsBits } from 'discord.js';
import configManager from '../../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../../utils/cooldown';
import { hasModAccess } from '../../../utils/permissions';
import { MESSAGES } from '../../../utils/messages';

export default {
  name: 'unban',
  description: 'Unbans a user from the server.',
  requiredUserPermissions: [PermissionFlagsBits.BanMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({
        content: MESSAGES.common.botMissingPermission('Ban Members'),
        allowedMentions: { parse: [] }
      });
    }
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.BanMembers]
    );

    if (!hasPermission) {
      return message.reply({
        content: MESSAGES.common.noPermission,
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('unban', message.author.id, message.guild?.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: MESSAGES.common.cooldownWait(seconds),
        allowedMentions: { parse: [] }
      });
    }
    if (message.guild) setCooldown('unban', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: MESSAGES.moderation.usage.unban,
        allowedMentions: { parse: [] }
      });
    }

    const reason = args.slice(1).join(' ') || MESSAGES.moderation.defaultReason;

    try {
      const bannedUsers = await message.guild?.bans.fetch();
      if (!bannedUsers?.has(userId)) {
        return message.reply({
          content: MESSAGES.moderation.notBanned,
          allowedMentions: { parse: [] }
        });
      }

      await message.guild?.members.unban(userId, reason);

      await message.reply({
        content: MESSAGES.moderation.reply.unbanned(userId),
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
      if (logChannel?.isTextBased()) {
        logChannel.send({
          content: MESSAGES.moderation.log.unban(userId, message.author.id, reason),
          allowedMentions: { parse: [] }
        });
      }

    } catch (error) {
      console.error(error);
      message.reply({
        content: MESSAGES.moderation.errors.unbanFailed,
        allowedMentions: { parse: [] }
      });
    }
  }
};

