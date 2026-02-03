import { Message, Client, User } from 'discord.js';
import configManager from '../../utils/ConfigManager';
export default {
  name: 'botdm',
  requiredRoles: [],

  async execute(message: Message, args: string[], _client: Client) {
    const config = await configManager.getOrCreateConfig(message.guild!);
    const requiredRoles: string[] = config.permissions.moderatorRoles || [];

    // Owner bypass
    const isOwner = message.author.id === config.permissions.ownerId;
    const hasRequiredRole = isOwner || message.member?.roles.cache.some(role =>
      requiredRoles.includes(role.id)
    );

    if (!hasRequiredRole) {
      return message.reply('You do not have permission to use this command.');
    }

    const userMention: User | undefined = message.mentions.users.first();
    if (!userMention) {
      return message.reply('Please mention a valid user.');
    }

    const text = args.slice(1).join(' ');
    if (!text) {
      return message.reply('nice I won\'t DM anyone.');
    }

    userMention.send(text)
      .then(() => message.reply('done'))
      .catch(() => message.reply('nice I won\'t DM anyone.'));
  }
};
