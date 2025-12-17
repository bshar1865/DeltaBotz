import { Message, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import configManager from '../../utils/ConfigManager';

export default {
  name: 'warn',
  description: 'Issues a warning to a user.',
  protectedRoles: [],


  async execute(message: Message, args: string[]) {
    const config = await configManager.getOrCreateConfig(message.guild!);
    const requiredRoles: string[] = config.permissions.moderatorRoles || [];
    const protectedRoles: string[] = requiredRoles;

    const member = message.member;
    if (!member) return;

    const hasRequiredRole = member.roles.cache.some(role =>
      requiredRoles.includes(role.id)
    );

    if (!hasRequiredRole) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    const user = message.mentions.members?.first();
    const reason = args.slice(1).join(' ') || 'No reason provided';

    if (!user) {
      return message.reply({
        content: 'Please mention a user to warn.',
        allowedMentions: { parse: [] }
      });
    }

    const hasProtectedRole = user.roles.cache.some(role =>
      protectedRoles.includes(role.id)
    );

    if (hasProtectedRole) {
      const embed = new EmbedBuilder()
        .setColor('Random')
        .setDescription('You cannot warn mods <a:AK_KannaPiano:1370142206739877959>');

      return message.reply({
        embeds: [embed],
        allowedMentions: { parse: [] }
      });
    }

    await message.reply({
      content: `<@${user.id}> has been **__WARNED__**`,
      allowedMentions: { parse: [] }
    });

    const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
    if (logChannel) {
      await logChannel.send({
        content: `<@${user.id}> has been **__WARNED__** by <@${message.author.id}> for: **${reason}**`,
        allowedMentions: { parse: [] }
      });
    }

    user.send(`You have been **__WARNED__** in **${message.guild?.name}** for: **${reason}**`)
      .catch(async () => {
        if (logChannel) {
          await logChannel.send({
            content: `Could not send DM to <@${user.id}> about the warning.`,
            allowedMentions: { parse: [] }
          });
        }
      });
  },
};
