import { Message, TextChannel, ChannelType, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { hasModAccess } from '../../utils/permissions';

export default {
  name: 'mutec',
  description: 'Mutes a user in the current channel (can view, cannot send).',
  requiredUserPermissions: [PermissionFlagsBits.ManageChannels],

  async execute(message: Message) {
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

    if (message.channel.type !== ChannelType.GuildText) return;

    const channel = message.channel as TextChannel;

    const me = message.guild.members.me;
    if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({
        content: 'I need Manage Channels permission to do that.',
        allowedMentions: { parse: [] }
      });
    }

    try {
      await channel.permissionOverwrites.edit(user, {
        ViewChannel: true,
        SendMessages: false
      });

      await message.reply({
        content: `Muted <@${user.id}> in this channel.`,
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
      if (logChannel) {
        logChannel.send({
          content: `<@${user.id}> has been __**MUTED**__ in ${channel.name} by <@${message.author.id}>.`,
          allowedMentions: { parse: [] }
        });
      }
    } catch (error) {
      console.error(error);
      message.reply({
        content: 'I cannot mute this person in this channel.',
        allowedMentions: { parse: [] }
      });
    }
  }
};

