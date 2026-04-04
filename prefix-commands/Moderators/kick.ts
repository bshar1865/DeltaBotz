import { EmbedBuilder, Message, PermissionFlagsBits } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';
import { hasModAccess } from '../../utils/permissions';

export default {
  name: 'kick',
  description: 'Kicks a user from the server.',
  requiredUserPermissions: [PermissionFlagsBits.KickMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply({
        content: 'I need Kick Members permission to do that.',
        allowedMentions: { parse: [] }
      });
    }
    const hasPermission = hasModAccess(
      message.member,
      message.author.id,
      config,
      [PermissionFlagsBits.KickMembers]
    );

    if (!hasPermission) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    const remaining = getCooldownRemaining('kick', message.author.id, message.guild?.id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      return message.reply({
        content: `Please wait ${seconds}s before using this command again.`,
        allowedMentions: { parse: [] }
      });
    }
    if (message.guild) setCooldown('kick', message.author.id, 10000, message.guild.id);

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: 'Please provide a user ID or mention to kick.',
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
          .setDescription('You cannot kick mods <a:AK_KannaPiano:1370142206739877959> ');
        return message.reply({ embeds: [embed] });
      }

      try {
        await member.send(`You have been __**KICKED**__ from **${message.guild.name}** for the following reason: ${reason}`);
      } catch {}

      await member.kick(reason);

      await message.reply({
        content: `<@${userId}> has been __**KICKED**__`,
        allowedMentions: { parse: [] }
      });

      const logChannelId = config.logging.logChannelId || '';
      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (logChannel && logChannel.isTextBased()) {
        logChannel.send({
          content: `Action: Kick\nUser: <@${userId}>\nBy: <@${message.author.id}>\nReason: ${reason}`,
          allowedMentions: { parse: [] }
        });
      }

    } catch (error) {
      console.error(error);
      message.reply({
        content: 'I was unable to kick user. Please check if the ID is correct or if user is still in the server.',
        allowedMentions: { parse: [] }
      });
    }
  }
};


