import { Message, Client, User, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { hasModAccess } from '../../utils/permissions';

export default {
  name: 'botdm',
  description: 'Sends a direct message to a mentioned user using the bot.',
  requiredUserPermissions: [PermissionFlagsBits.ManageMessages],
  requiredRoles: [],

  async execute(message: Message, args: string[], _client: Client) {
    const config = await configManager.getOrCreateConfig(message.guild!);
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.ManageMessages]
    );

    if (!hasPermission) {
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
