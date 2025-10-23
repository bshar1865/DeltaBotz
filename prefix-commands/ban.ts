import { Message, Client, TextChannel, EmbedBuilder, GuildMember } from 'discord.js';
import idclass from '../utils/idclass';
import configManager from '../utils/ConfigManager';

export default {
  name: 'ban',
  description: 'Bans a user from the server.',

  checkPermission(message: Message, config: any): boolean {
    // Owner bypass
    if (message.author.id === config.permissions.ownerId) return true;
    
    // Check if user has any of the required roles
    const allModRoles = config.permissions.moderatorRoles;
    
    return message.member?.roles.cache.some(role => 
      allModRoles.includes(role.id)
    ) || false;
  },

  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;

    // Get server configuration
    const config = await configManager.getOrCreateConfig(message.guild);
    
    // Check permissions
    const hasPermission = this.checkPermission(message, config);
    if (!hasPermission) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) {
      return message.reply({
        content: 'Please provide a user ID or mention to ban.',
        allowedMentions: { parse: [] }
      });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      // Check if user is already banned
      const bans = await message.guild?.bans.fetch();
      if (bans?.has(userId)) {
        return message.reply({
          content: 'This user is already banned.',
          allowedMentions: { parse: [] }
        });
      }

      // Try to fetch user from server first
      const guildMember = await message.guild?.members.fetch(userId).catch(() => null);
      
      // If user is in server, check for protected roles
      if (guildMember) {
        if (guildMember.roles.cache.some(role => (config.permissions.moderatorRoles||[]).includes(role.id))) {
          const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setDescription('You cannot ban mods <:DogHush:1331679185072029798>');
          return message.reply({ embeds: [embed] });
        }

        // Try to DM user if they're in the server
        try {
          await guildMember.send(`You have been __**BANNED**__ from **${message.guild?.name}** for the following reason: ${reason}`);
        } catch (dmError) {
          const logChannelId = config.logging.logChannelId || '';
          const logChannel = message.guild?.channels.cache.get(logChannelId) as TextChannel | undefined;
          if (logChannel) {
            logChannel.send({
              content: `Could not send Ban DM to <@${userId}>.`,
              allowedMentions: { parse: [] }
            });
          }
        }

        await guildMember.ban({ reason });
      } else {
        // If user is not in server, try to fetch them from Discord API
        try {
          const user = await client.users.fetch(userId);
          await message.guild?.members.ban(userId, { reason });
        } catch (error) {
          return message.reply({
            content: 'Invalid user ID provided. Please make sure the ID is correct.',
            allowedMentions: { parse: [] }
          });
        }
      }

      await message.reply({
        content: `<@${userId}> has been __**BANNED**__.[⠀](https://tenor.com/view/persona-3-reload-episode-aigis-persona-persona-3-persona-3-reload-joker-persona-3-reload-joker-fight-gif-12722693221088524996)`,
        allowedMentions: { parse: [] }
      });

      const logChannelId = config.logging.logChannelId || '';
      const logChannel = message.guild?.channels.cache.get(logChannelId) as TextChannel | undefined;
      if (logChannel && config.logging.events.banAdd) {
        logChannel.send({
          content: `<@${userId}> has been __**BANNED**__ by <@${message.author.id}> for: ${reason}`,
          allowedMentions: { parse: [] }
        });
      }

    } catch (error) {
      console.error(error);
      message.reply({
        content: 'I was unable to ban user. Please check if the ID is correct or if user is already banned.',
        allowedMentions: { parse: [] }
      });
    }
  }
};
