import {
    Message,
    Client,
    GuildMember,
    TextChannel,
    EmbedBuilder
  } from 'discord.js';
import configManager from '../utils/ConfigManager';
  export default {
    name: 'softban',
    description: 'Softbans a user (bans, deletes messages, DMs an invite, then unbans).',
    requiredRoles: [],
    async execute(message: Message, args: string[], client: Client) {
      const config = await configManager.getOrCreateConfig(message.guild!);
      const modRoles: string[] = config.permissions.moderatorRoles || [];
      const hasRequiredRole = message.member?.roles.cache.some(role => modRoles.includes(role.id));
      if (!hasRequiredRole) {
        return message.reply({
          content: 'You do not have permission to use this command.',
          allowedMentions: { parse: [] }
        });
      }
  
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
          .setDescription('You cannot softban mods. <a:AK_KannaPiano:1370142206739877959> ');

        if (user.roles.cache.some(role => (config.permissions.moderatorRoles||[]).includes(role.id))) {
    return message.reply({ embeds: [DevEmbed] });
}

  
        // DM user
        try {
          await user.send(
            `You have been __**SOFTBANNED**__ from **${message.guild?.name}** for the following reason: ${reason}.`
          );
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
        await user.ban({ deleteMessageSeconds: 60 * 60 * 24 * 7, reason: `Softban: ${reason}` });
        message.reply({
          content: `<@${userId}> has been __**SOFTBANNED**__.`,
          allowedMentions: { parse: [] }
        });
  
        const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '');
        if (logChannel && logChannel.isTextBased()) {
          (logChannel as TextChannel).send({
            content: `<@${userId}> has been __**SOFTBANNED**__ by <@${message.author.id}> for: ${reason}`,
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
  