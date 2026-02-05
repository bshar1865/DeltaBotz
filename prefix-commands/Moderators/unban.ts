import {
    GuildMember,
    Message,
    TextChannel,
    EmbedBuilder
  } from 'discord.js';
import idclass from '../../utils/idclass';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';

  export default {
    name: 'unban',
    description: 'Unbans a user from the server.',
    requiredRoles: [],
  
    async execute(message: Message, args: string[]) {
      const config = await configManager.getOrCreateConfig(message.guild!);
      const requiredRoles: string[] = config.permissions.moderatorRoles || [];

      // Owner bypass
      const isOwner = message.author.id === config.permissions.ownerId || message.author.id === idclass.ownershipID();
      const hasRequiredRole = isOwner || message.member?.roles.cache.some(role =>
        requiredRoles.includes(role.id)
      );

      if (!hasRequiredRole) {
        return message.reply({ content: 'You do not have permission to use this command.' });
      }

      const remaining = getCooldownRemaining('unban', message.author.id, message.guild?.id);
      if (remaining > 0) {
        const seconds = Math.ceil(remaining / 1000);
        return message.reply({ content: `Please wait ${seconds}s before using this command again.` });
      }
      if (message.guild) setCooldown('unban', message.author.id, 10000, message.guild.id);
  
      const userId = args[0]?.replace(/[<@!>]/g, '');
      if (!userId) {
        return message.reply({ content: 'Please provide a user ID to unban.' });
      }
  
      const reason = args.slice(1).join(' ') || 'No reason provided';
  
      try {
        const bannedUsers = await message.guild?.bans.fetch();
        const bannedUser = bannedUsers?.get(userId);
  
        if (!bannedUser) {
          return message.reply({ content: 'user is likely unbanned.' });
        }
  
        await message.guild?.members.unban(userId, reason);
  
        if (message.channel.isTextBased()) {
          await message.reply({
            content: `${bannedUser.user.tag} has been __**UNBANNED**__.`,
            allowedMentions: { parse: [] }
          });
        }
  
        const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
        if (logChannel?.isTextBased()) {
          await logChannel.send({
            content: `Action: Unban\nUser: ${bannedUser.user.tag}\nBy: <@${message.author.id}>\nReason: ${reason}`,
            allowedMentions: { parse: [] }
          });
        }
      } catch (error) {
        console.error(error);
        await message.reply({ content: 'I was unable to unban the user.' });
      }
    }
  };
  
