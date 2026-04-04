import { EmbedBuilder, Message, PermissionFlagsBits, TextChannel } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';
import { hasModAccess } from '../../utils/permissions';

export default {
  name: 'mute',
  description: 'Times out a user for a specified duration.',
  requiredUserPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({
        content: 'I need Moderate Members permission to do that.',
        allowedMentions: { parse: [] }
      });
    }
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.ModerateMembers]
    );

    if (!hasPermission) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('mute', message.author.id, message.guild.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: `Please wait ${seconds}s before using this command again.`,
        allowedMentions: { parse: [] }
      });
    }
    setCooldown('mute', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      const embed = new EmbedBuilder()
        .setColor('Random')
        .setDescription('Please provide a user ID or mention to mute.');
      return message.reply({ embeds: [embed] });
    }

    const duration = args[1];
    if (!duration) {
      const embed = new EmbedBuilder()
        .setColor('Random')
        .setDescription('Please provide a duration (e.g., 10s, 5m, 2h, 1d).');
      return message.reply({ embeds: [embed] });
    }

    const reason = args.slice(2).join(' ') || 'No reason provided';

    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      const embed = new EmbedBuilder()
        .setColor('Random')
        .setDescription('Invalid duration format. Use s, m, h, or d (e.g., 10s, 5m, 2h, 1d).');
      return message.reply({ embeds: [embed] });
    }

    const amount = parseInt(match[1]);
    const unit = match[2];
    const durationMs = unit === 's' ? amount * 1000 : unit === 'm' ? amount * 60000 : unit === 'h' ? amount * 3600000 : amount * 86400000;

    try {
      const member = await message.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        const embed = new EmbedBuilder()
          .setColor('Random')
          .setDescription('Could not find the specified user in this server.');
        return message.reply({ embeds: [embed] });
      }

      if (member.roles.cache.some(role => (config.permissions.moderatorRoles || []).includes(role.id))) {
        const embed = new EmbedBuilder()
          .setColor('Random')
          .setDescription('You cannot mute mods <a:AK_KannaPiano:1370142206739877959> ');
        return message.reply({ embeds: [embed] });
      }

      await member.timeout(durationMs, reason);

      const embed = new EmbedBuilder()
        .setColor('Random')
        .setDescription(`Muted <@${userId}> for **${duration}** due to: **${reason}**`);
      await message.reply({ embeds: [embed] });

      const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
      if (logChannel?.type === 0) {
        logChannel.send({
          content: `Action: Mute\nUser: <@${userId}>\nBy: <@${message.author.id}>\nDuration: ${duration}\nReason: ${reason}`,
          allowedMentions: { parse: [] }
        });
      }

      try {
        await member.send(`You have been __**MUTED**__ in **${message.guild?.name}** for **${duration}** due to: **${reason}**`);
      } catch {}

      setTimeout(async () => {
        try {
          await member.send(`Your mute in **${message.guild?.name}** has ended.`);
        } catch {}
        if (logChannel?.type === 0) {
          logChannel.send({
            content: `Action: Unmute\nUser: <@${userId}>\nBy: <@${message.author.id}>`,
            allowedMentions: { parse: [] }
          }).catch(() => {});
        }
      }, durationMs);

    } catch (error) {
      console.error(error);
      const embed = new EmbedBuilder()
        .setColor('Random')
        .setDescription('I was unable to mute this user. Make sure I have permission and the user is valid.');
      message.reply({ embeds: [embed] });
    }
  }
};

