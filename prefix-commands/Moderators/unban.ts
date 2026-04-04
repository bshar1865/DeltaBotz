import { Message, GuildMember, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';
import { hasModAccess } from '../../utils/permissions';

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
        content: 'I need Ban Members permission to do that.',
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
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('unban', message.author.id, message.guild?.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: `Please wait ${seconds}s before using this command again.`,
        allowedMentions: { parse: [] }
      });
    }
    if (message.guild) setCooldown('unban', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: 'Please provide a user ID or mention to unban.',
        allowedMentions: { parse: [] }
      });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      const bannedUsers = await message.guild?.bans.fetch();
      if (!bannedUsers?.has(userId)) {
        return message.reply({
          content: 'This user is not banned.',
          allowedMentions: { parse: [] }
        });
      }

      await message.guild?.members.unban(userId, reason);

      await message.reply({
        content: `<@${userId}> has been __**UNBANNED**__`,
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
      if (logChannel?.isTextBased()) {
        logChannel.send({
          content: `Action: Unban\nUser: <@${userId}>\nBy: <@${message.author.id}>\nReason: ${reason}`,
          allowedMentions: { parse: [] }
        });
      }

    } catch (error) {
      console.error(error);
      message.reply({
        content: 'I was unable to unban user. Please check if the ID is correct.',
        allowedMentions: { parse: [] }
      });
    }
  }
};

