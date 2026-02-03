import { Message, GuildMember, TextChannel, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';

export default {
  name: 'removec',
  description: 'Removes a user\'s access to the current channel.',
  requiredRoles: [],

  async execute(message: Message, args: string[]) {
    const config = await configManager.getOrCreateConfig(message.guild!);
    
    // Owner bypass
    const isOwner = message.author.id === config.permissions.ownerId;
    const hasRequiredRole = isOwner || message.member?.roles.cache.some(role => (config.permissions.moderatorRoles||[]).includes(role.id));
    if (!hasRequiredRole) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    const user = message.mentions.members?.first();
    if (!user) {
      return message.reply({
        content: 'Please mention a valid user.',
        allowedMentions: { parse: [] }
      });
    }

    const channel = message.channel;
    if (!channel.isTextBased() || channel.type !== 0) return;

    const restrictedCategories: string[] = []; 

    const isRestricted = restrictedCategories.includes(channel.parentId || '');
    if (isRestricted) {
      return message.reply({
        content: 'Sus.',
        allowedMentions: { parse: [] }
      });
    }

    try {
      await channel.permissionOverwrites.edit(user, {
        ViewChannel: false,
        SendMessages: false
      });

      await message.reply({
        content: `Removed <@${user.user.id}> from the channel successfully.`,
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
      if (logChannel) {
        logChannel.send({
          content: `<@${user.user.id}> has been __**REMOVED**__ from ${channel.name} by <@${message.author.id}>.`,
          allowedMentions: { parse: [] }
        });
      }

    } catch (error) {
      console.error(error);
      message.reply({
        content: 'I cannot remove this person from this channel.',
        allowedMentions: { parse: [] }
      });
    }
  }
};
