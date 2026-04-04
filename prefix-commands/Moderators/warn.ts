import { Message, GuildMember, EmbedBuilder, TextChannel, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { hasModAccess } from '../../utils/permissions';

export default {
  name: 'warn',
  description: 'Warns a user in the server.',
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

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: 'Please provide a user ID or mention to warn.',
        allowedMentions: { parse: [] }
      });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply({
          content: 'Could not find the specified user in this server.',
          allowedMentions: { parse: [] }
        });
      }

      if (member.roles.cache.some(role => (config.permissions.moderatorRoles || []).includes(role.id))) {
        const embed = new EmbedBuilder()
          .setColor('Random')
          .setDescription('You cannot warn mods <a:AK_KannaPiano:1370142206739877959> ');
        return message.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor('Random')
        .setDescription(`<@${userId}> has been __**WARNED**__`);
      await message.reply({ embeds: [embed] });

      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
      if (logChannel && config.logging.events.warn) {
        logChannel.send({
          content: `Action: Warn\nUser: <@${userId}>\nBy: <@${message.author.id}>\nReason: ${reason}`,
          allowedMentions: { parse: [] }
        });
      }

      member.send(`You have been **__WARNED__** in **${message.guild?.name}** for: **${reason}**`)
        .catch(() => {});

    } catch (error) {
      console.error(error);
      message.reply({
        content: 'I was unable to warn user. Please check if the ID is correct.',
        allowedMentions: { parse: [] }
      });
    }
  }
};


