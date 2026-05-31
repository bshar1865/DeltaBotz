import { Message, PermissionFlagsBits } from 'discord.js';
import configManager from '../../../utils/ConfigManager';
import { MESSAGES } from '../../../utils/messages';
import { hasModAccess } from '../../../utils/permissions';
import {
  addWhitelistedUserIds,
  getWhitelistedUserIds,
  parseWhitelistIds,
  removeWhitelistedUserIds,
} from '../../../utils/whitelist';

export default {
  name: 'whitelist',
  description: 'Manage the server join whitelist.',
  requiredUserPermissions: [PermissionFlagsBits.ManageGuild],

  checkPermission(message: Message, config: any): boolean {
    return hasModAccess(message.member, message.author.id, config, [PermissionFlagsBits.ManageGuild]);
  },

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    if (!config.features?.whitelistEnforcement?.enabled) return;

    const hasPermission = this.checkPermission(message, config);
    if (!hasPermission) {
      return message.reply({
        content: MESSAGES.common.noPermission,
        allowedMentions: { parse: [] },
      });
    }

    const action = args[0]?.toLowerCase();
    if (!action || action === 'help') {
      return message.reply({
        content: MESSAGES.whitelist.usage,
        allowedMentions: { parse: [] },
      });
    }

    if (action === 'list') {
      const userIds = getWhitelistedUserIds(config);
      if (userIds.length === 0) {
        return message.reply({
          content: MESSAGES.whitelist.noWhitelisted,
          allowedMentions: { parse: [] },
        });
      }

      const lines = userIds.map((userId) => {
        const member = message.guild?.members.cache.get(userId);
        return member ? `${member.user.tag} (<@${userId}>)` : `<@${userId}>`;
      });

      const chunks: string[] = [];
      let current = '';
      for (const line of lines) {
        if (current.length + line.length + 1 > 1900) {
          chunks.push(current);
          current = '';
        }
        current += `${line}\n`;
      }
      if (current) chunks.push(current);

      for (const chunk of chunks) {
        await message.reply({
          content: chunk,
          allowedMentions: { parse: [] },
        });
      }
      return;
    }

    const removeMode = action === 'remove' || action === 'rm' || action === 'unwhitelist';
    const idArgs = removeMode ? args.slice(1) : action === 'add' ? args.slice(1) : args;
    const ids = parseWhitelistIds(idArgs);

    if (ids.length === 0) {
      return message.reply({
        content: MESSAGES.whitelist.invalidIds,
        allowedMentions: { parse: [] },
      });
    }

    if (removeMode) {
      const removed = removeWhitelistedUserIds(config, ids);
      await configManager.saveServerConfig(config);
      return message.reply({
        content: removed > 0 ? MESSAGES.whitelist.removed(removed) : MESSAGES.whitelist.noWhitelisted,
        allowedMentions: { parse: [] },
      });
    }

    const added = addWhitelistedUserIds(config, ids);
    await configManager.saveServerConfig(config);
    return message.reply({
      content: added > 0 ? MESSAGES.whitelist.added(added) : MESSAGES.whitelist.alreadyWhitelisted,
      allowedMentions: { parse: [] },
    });
  },
};
