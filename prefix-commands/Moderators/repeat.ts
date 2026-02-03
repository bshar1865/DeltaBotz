import { Message, Client, TextChannel } from 'discord.js';
import configManager from '../../utils/ConfigManager';

export default {
  name: 'cmd',
  description: 'Repeats a message.',
  requiredRoles: [],

  async execute(message: Message, args: string[], client: Client) {
    const config = await configManager.getOrCreateConfig(message.guild!);
    const requiredRoles: string[] = config.permissions.moderatorRoles || [];

    // Owner bypass
    const isOwner = message.author.id === config.permissions.ownerId;
    const hasRequiredRole = isOwner || message.member?.roles.cache.some(role => requiredRoles.includes(role.id));

    if (!hasRequiredRole) {
      return message.reply({ content: 'You do not have permission to use this command.' });
    }

    const input = message.content.trim();
    const matches = input.match(/[\.\?](\w+)/g);

    if (matches && matches.length > 1 && matches[0] === matches[1]) {
      return message.reply("You can't run the same command inside itself.");
    }

    let channel = message.mentions.channels.first() as TextChannel | null;
    let text: string;

    if (channel) {
      text = args.slice(1).join(' ');
    } else {
      channel = message.channel as TextChannel;
      text = args.join(' ');
    }

    if (!text) {
      return message.reply({ content: 'Please provide text to repeat.' });
    }

    if (channel.permissionsFor(client.user!)?.has('SendMessages')) {
      channel.send({ content: text }).catch(() => {
        message.reply({
          content: 'Failed to repeat message. Please make sure the bot has permission to send messages in that channel.'
        });
      });
    } else {
      message.reply({ content: 'I do not have permission to send messages in that channel.' });
    }
  }
};
