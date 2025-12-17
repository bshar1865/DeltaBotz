import {
  ChatInputCommandInteraction,
  Message,
  TextChannel,
  GuildMember,
  ChannelType,
  User
} from 'discord.js';
import configManager from '../../utils/ConfigManager';

export default {
  name: 'purge',
  description: 'Deletes up to 100 messages from the channel. Supports user-specific purging.',
  usage: '.purge <number> or .purge @User <number>',

  execute: async (message: Message, args: string[]) => {
    const member = message.member as GuildMember;
    const config = await configManager.getOrCreateConfig(message.guild!);

    if (!member.roles.cache.some(role => (config.permissions.moderatorRoles||[]).includes(role.id))) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    if (!args.length || (isNaN(Number(args[0])) && !message.mentions.users.first())) {
      return message.reply({
        content: 'Invalid usage. Use `.purge <number>` or `.purge @User <number>`.',
        allowedMentions: { parse: [] }
      });
    }

    const targetUser: User | undefined = message.mentions.users.first();
    const messageLimit: number = targetUser ? parseInt(args[1]) : parseInt(args[0]);

    if (!messageLimit || messageLimit < 1 || messageLimit > 100) {
      return message.reply({
        content: 'Please specify a number between 1 and 100.',
        allowedMentions: { parse: [] }
      });
    }

    try {
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const currentTime = Date.now();
      const maxAge = 14 * 24 * 60 * 60 * 1000; // 14 days in ms

      const filteredMessages = Array.from(
        messages
          .filter(msg =>
            (targetUser ? msg.author.id === targetUser.id : true) &&
            (currentTime - msg.createdTimestamp < maxAge)
          )
          .values()
      ).slice(0, messageLimit + 1); // +1 just in case

      if (message.channel.type === ChannelType.GuildText || message.channel.type === ChannelType.GuildAnnouncement) {
        await (message.channel as TextChannel).bulkDelete(filteredMessages, true);
      } else {
        return message.reply("This command can only be used in a text channel.");
      }
      
      const modlogChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
      if (
        !modlogChannel ||
        modlogChannel.type !== ChannelType.GuildText
      ) {
        console.error('Modlog channel is invalid or not found.');
        return message.reply({
          content: 'Modlog channel not configured or invalid.',
          allowedMentions: { parse: [] }
        });
      }

      await (modlogChannel as TextChannel).send({
        content: `<@${member.user.id}> has __**PURGED**__ ${filteredMessages.length} message(s) in ${message.channel.toString()}`,
        allowedMentions: { parse: [] }
      });

    } catch (err) {
      console.error('Error while purging messages:', err);
      return message.reply({
        content: 'Failed to delete messages. Make sure messages are under 14 days old.',
        allowedMentions: { parse: [] }
      });
    }
  }
};
