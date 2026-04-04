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
        content: 'I need Ban Members permission to do that.',
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
        content: 'You do not have permission to use this command.',
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
        content: 'Please provide a user ID or mention to softban.',
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
        .setDescription('You cannot softban mods.');

      if (user.roles.cache.some(role => (config.permissions.moderatorRoles||[]).includes(role.id))) {
        return message.reply({ embeds: [DevEmbed] });
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
        const lines = [
          `Hi, you have been **softbanned** from **${message.guild?.name}** for: ${reason}.`,
          'If your account was hacked or compromised, please secure it (change your password, enable 2FA).',
          'Once you\'re safe, you\'re welcome back.'
        ];

        if (allowInvite && inviteUrl) {
          lines.push(`Here\'s a server invite you can use to rejoin: ${inviteUrl}`);
        }

        await user.send(lines.join('\n'));
      } catch {
        const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
        if (logChannel && logChannel.isTextBased()) {
          (logChannel as TextChannel).send({
            content: `Could not send Softban DM to <@${userId}>.`,
            allowedMentions: { parse: [] }
          });
        }
      }

      // Ban
      await user.ban({ reason: `Softban: ${reason}` });
      message.reply({
        content: `<@${userId}> has been __**SOFTBANNED**__.`,
        allowedMentions: { parse: [] }
      });

      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
      if (logChannel && logChannel.isTextBased()) {
        (logChannel as TextChannel).send({
          content: `Action: Softban\nUser: <@${userId}>\nBy: <@${message.author.id}>\nReason: ${reason}`,
          allowedMentions: { parse: [] }
        });
      }

      // Unban after delay
      setTimeout(async () => {
        await message.guild?.bans.remove(userId, 'Softban completed');
        message.reply({
          content: `<@${userId}> has been __**UNBANNED**__ (softban completed).`,
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

