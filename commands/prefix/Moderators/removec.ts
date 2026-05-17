import { Message, TextChannel, PermissionFlagsBits } from 'discord.js';
import configManager from '../../../utils/ConfigManager';
import { hasModAccess } from '../../../utils/permissions';

export default {
  name: 'removec',
  description: 'Removes a user\'s access to the current channel.',
  requiredUserPermissions: [PermissionFlagsBits.ManageChannels],
  requiredRoles: [],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);

    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.ManageChannels]
    );
    if (!hasPermission) {
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
    const me = message.guild.members.me;
    if (channel.isTextBased() && channel.type === 0) {
      if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
        return message.reply({
          content: 'I need Manage Channels permission to do that.',
          allowedMentions: { parse: [] }
        });
      }
    }
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

      const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
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
