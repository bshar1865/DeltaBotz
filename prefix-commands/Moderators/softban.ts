import {
    Message,
    Client,
    TextChannel,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
  } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';
import { hasModAccess } from '../../utils/permissions';
import { canModerateTarget } from '../../utils/canModerateTarget';
import { MESSAGES } from '../../utils/messages';

export default {
  name: 'softban',
  description: 'Softbans a user (ban + delete messages, then unban).',
  requiredUserPermissions: [PermissionFlagsBits.BanMembers],
  requiredRoles: [],

  async execute(message: Message, args: string[], client: Client) {
    const config = await configManager.getOrCreateConfig(message.guild!);
    const me = message.guild?.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({
        content: MESSAGES.common.botMissingPermission('Ban Members'),
        allowedMentions: { parse: [] }
      });
    }
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.BanMembers]
    );

    if (!hasPermission) {
      return message.reply({
        content: MESSAGES.common.noPermission,
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('softban', message.author.id, message.guild?.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: `Please wait ${seconds}s before using this command again.`,
        allowedMentions: { parse: [] }
      });
    }
    if (message.guild) setCooldown('softban', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: MESSAGES.moderation.usage.softban,
        allowedMentions: { parse: [] }
      });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      const user = await message.guild?.members.fetch(userId).catch(() => null);
      if (!user) {
        return message.reply({
          content: 'Could not find this user in the server.',
          allowedMentions: { parse: [] }
        });
      }

      const DevEmbed = new EmbedBuilder()
        .setColor('Random')
        .setDescription(MESSAGES.moderation.cannotActionMods('softban'));

      if (user.roles.cache.some(role => (config.permissions.moderatorRoles||[]).includes(role.id))) {
        return message.reply({ embeds: [DevEmbed] });
      }

      if (message.member) {
        const guard = canModerateTarget(message.member, user, message.guild!);
        if (!guard.ok) {
          return message.reply({ content: guard.reason, allowedMentions: { parse: [] } });
        }
      }

      const allowInvite = Boolean(config.features?.honeypot?.autoUnban);
      let inviteUrl: string | null = null;

      if (allowInvite) {
        const me = message.guild?.members.me;
        const inviteChannel = message.guild?.channels.cache.find(ch =>
          (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) &&
          me?.permissionsIn(ch).has(PermissionFlagsBits.CreateInstantInvite)
        );

        if (inviteChannel && inviteChannel.isTextBased()) {
          try {
            const invite = await (inviteChannel as TextChannel).createInvite({
              maxAge: 0,
              maxUses: 0,
              unique: true,
              reason: 'Softban rejoin link'
            });
            inviteUrl = invite.url;
          } catch {
            inviteUrl = null;
          }
        }
      }

      // DM user
      try {
        await user.send(MESSAGES.moderation.dm.softban(message.guild?.name || 'this server', reason, allowInvite ? inviteUrl : null));
      } catch {
        const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
        if (logChannel && logChannel.isTextBased()) {
          (logChannel as TextChannel).send({
            content: MESSAGES.moderation.log.dmFailedSoftban(userId),
            allowedMentions: { parse: [] }
          });
        }
      }

      // Ban
      await user.ban({ reason: `Softban: ${reason}` });
      message.reply({
        content: MESSAGES.moderation.reply.softbanned(userId),
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
      if (logChannel && logChannel.isTextBased()) {
        (logChannel as TextChannel).send({
          content: MESSAGES.moderation.log.softban(userId, message.author.id, reason),
          allowedMentions: { parse: [] }
        });
      }

      // Unban after delay
      setTimeout(async () => {
        await message.guild?.bans.remove(userId, 'Softban completed');
        message.reply({
          content: MESSAGES.moderation.reply.softbanUnbanned(userId),
          allowedMentions: { parse: [] }
        });
      }, 3000);
    } catch (err) {
      console.error(err);
      message.reply({
        content: 'I was unable to softban user. Please check if the ID is correct.',
        allowedMentions: { parse: [] }
      });
    }
  }
};

