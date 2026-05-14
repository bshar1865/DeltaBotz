import { Message, Client, TextChannel, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';
import { hasModAccess } from '../../utils/permissions';
import { canModerateTarget } from '../../utils/canModerateTarget';
import { MESSAGES } from '../../utils/messages';

function parsePipeList(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
}

const BAN_GIFS: string[] = parsePipeList(process.env.BAN_GIFS);

function pickRandom<T>(items: T[]): T | null {
  if (!items || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export default {
  name: 'ban',
  description: 'Bans a user from the server.',
  requiredUserPermissions: [PermissionFlagsBits.BanMembers],

  checkPermission(message: Message, config: any): boolean {
    return hasModAccess(message.member, message.author.id, config, [PermissionFlagsBits.BanMembers]);
  },

  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;

    // Get server configuration
    const config = await configManager.getOrCreateConfig(message.guild);
    
    // Check permissions
    const hasPermission = this.checkPermission(message, config);
    if (!hasPermission) {
      return message.reply({
        content: MESSAGES.common.noPermission,
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('ban', message.author.id, message.guild?.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: MESSAGES.common.cooldownWait(seconds),
        allowedMentions: { parse: [] }
      });
    }
    if (message.guild) setCooldown('ban', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: MESSAGES.moderation.usage.ban,
        allowedMentions: { parse: [] }
      });
    }

    const reason = args.slice(1).join(' ') || MESSAGES.moderation.defaultReason;

    try {
      // Check if user is already banned
      const bans = await message.guild?.bans.fetch();
      if (bans?.has(userId)) {
        return message.reply({
          content: MESSAGES.moderation.alreadyBanned,
          allowedMentions: { parse: [] }
        });
      }

      // Try to fetch user from server first
      const guildMember = await message.guild?.members.fetch(userId).catch(() => null);
      
      // If user is in server, check for protected roles
      if (guildMember) {
        if (guildMember.roles.cache.some(role => (config.permissions.moderatorRoles||[]).includes(role.id))) {
          return message.reply({ content: MESSAGES.moderation.cannotActionMods('ban'), allowedMentions: { parse: [] } });
        }

        if (message.member) {
          const guard = canModerateTarget(message.member, guildMember, message.guild);
          if (!guard.ok) {
            return message.reply({ content: guard.reason, allowedMentions: { parse: [] } });
          }
        }

        // Try to DM user if they're in the server
        try {
          await guildMember.send(MESSAGES.moderation.dm.banned(message.guild?.name || 'this server', reason));
        } catch (dmError) {
          const logChannelId = config.logging.logChannelId || '';
          const logChannel = message.guild?.channels.cache.get(logChannelId) as TextChannel | undefined;
          if (logChannel) {
            logChannel.send({
              content: MESSAGES.moderation.log.dmFailedBan(userId),
              allowedMentions: { parse: [] }
            });
          }
        }

        await guildMember.ban({ reason });
      } else {
        // If user is not in server, try to fetch them from Discord API
        try {
          await client.users.fetch(userId);
          await message.guild?.members.ban(userId, { reason });
        } catch (error) {
          return message.reply({
            content: MESSAGES.common.invalidUserId,
            allowedMentions: { parse: [] }
          });
        }
      }

      const gifUrl = pickRandom(BAN_GIFS);
      const content = gifUrl ? `${MESSAGES.moderation.reply.banned(userId)} [⠀](${gifUrl})` : MESSAGES.moderation.reply.banned(userId);

      await message.reply({ content, allowedMentions: { parse: [] } });

      const logChannelId = config.logging.logChannelId || '';
      const logChannel = message.guild?.channels.cache.get(logChannelId) as TextChannel | undefined;
      if (logChannel && config.logging.events.banAdd) {
        logChannel.send({
          content: MESSAGES.moderation.log.ban(userId, message.author.id, reason),
          allowedMentions: { parse: [] }
        });
      }

    } catch (error) {
      console.error(error);
      message.reply({
        content: MESSAGES.moderation.errors.banFailed,
        allowedMentions: { parse: [] }
      });
    }
  }
};
