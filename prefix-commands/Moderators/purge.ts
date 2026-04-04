import { Message, GuildMember, TextChannel, ChannelType, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';
import { hasModAccess } from '../../utils/permissions';

export default {
  name: 'purge',
  description: 'Deletes a number of messages in the current channel.',
  requiredUserPermissions: [PermissionFlagsBits.ManageMessages],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const member = message.member as GuildMember;
    const config = await configManager.getOrCreateConfig(message.guild);
    const channel = message.channel;
    const me = message.guild.members.me;

    if (channel.isTextBased() && !me?.permissionsIn(channel as any).has(PermissionFlagsBits.ManageMessages)) {
      return message.reply({
        content: 'I need Manage Messages permission to do that.',
        allowedMentions: { parse: [] }
      });
    }

    const hasPermission = hasModAccess(
      member,
      message.author.id,
      config,
      [PermissionFlagsBits.ManageMessages]
    );

    if (!hasPermission) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('purge', message.author.id, message.guild.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: `Please wait ${seconds}s before using this command again.`,
        allowedMentions: { parse: [] }
      });
    }
    setCooldown('purge', message.author.id, 5000, message.guild.id);

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({
        content: 'Please provide a number between 1 and 100 for the amount of messages to delete.',
        allowedMentions: { parse: [] }
      });
    }

    try {
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
        const deleted = await channel.bulkDelete(amount, true);
        await channel.send({
          content: `Deleted ${deleted.size} messages.`,
          allowedMentions: { parse: [] }
        }).catch(() => {});
      }

      const modlogChannel = message.guild.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
      if (modlogChannel && modlogChannel.type === ChannelType.GuildText) {
        modlogChannel.send({
          content: `Action: Purge\nBy: <@${message.author.id}>\nAmount: ${amount}\nChannel: <#${message.channel.id}>`,
          allowedMentions: { parse: [] }
        }).catch(() => {});
      }
    } catch (error) {
      console.error(error);
      if (channel.isTextBased() && "send" in channel) {
        (channel as any).send({
          content: 'I was unable to delete messages. Make sure I have the right permissions.',
          allowedMentions: { parse: [] }
        }).catch(() => {});
      }
    }
  }
};

