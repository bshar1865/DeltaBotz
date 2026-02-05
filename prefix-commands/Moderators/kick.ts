import { EmbedBuilder, Message } from 'discord.js';
import idclass from '../../utils/idclass';
import configManager from '../../utils/ConfigManager';
import { getCooldownRemaining, setCooldown } from '../../utils/cooldown';

export default {
    name: 'kick',
    description: 'Kicks a user from the server.',

  checkPermission(message: Message, config: any): boolean {
    if (message.author.id === config.permissions.ownerId || message.author.id === idclass.ownershipID()) return true;
    const allModRoles = config.permissions.moderatorRoles;
    return message.member?.roles.cache.some(role => allModRoles.includes(role.id)) || false;
  },

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const config = await configManager.getOrCreateConfig(message.guild);
    const hasPermission = this.checkPermission(message, config);
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
    setCooldown('kick', message.author.id, 10000, message.guild.id);

        const userId = args[0]?.replace(/[<@!>]/g, '');
        if (!userId) {
            return message.reply({
                content: 'Please provide a user mention or ID to kick.',
                allowedMentions: { parse: [] }
            });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) {
                return message.reply({
                    content: 'Could not find this user in the server.',
                    allowedMentions: { parse: [] }
                });
            }

      if (member.roles.cache.some(r => (config.permissions.moderatorRoles || []).includes(r.id))) {
                const embed = new EmbedBuilder()
                    .setColor('Random')
          .setDescription('You cannot kick mods.');
                return message.reply({ embeds: [embed] });
            }

      if (!member.kickable) {
                return message.reply({
                    content: 'I cannot kick this user. They might have a higher role or permissions.',
                    allowedMentions: { parse: [] }
                });
            }

            try {
        await member.send(`You have been __**KICKED**__ from **${message.guild.name}** for the following reason: ${reason}`);
            } catch {
        const logChannelId = config.logging.logChannelId || '';
        const logChannel = message.guild.channels.cache.get(logChannelId);
                if (logChannel?.isTextBased()) {
                    logChannel.send({
                        content: `Could not send DM to <@${userId}> before kick.`,
                        allowedMentions: { parse: [] }
                    });
                }
            }

      await member.kick(reason);
      if ('send' in message.channel) {
            await message.channel.send({
          content: `<@${userId}> has been __**KICKED**__.`,
                allowedMentions: { parse: [] }
            });
      }

      const logChannelId = config.logging.logChannelId || '';
      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (logChannel?.isTextBased() && config.logging.events.kick) {
                logChannel.send({
          content: `Action: Kick\nUser: <@${userId}>\nBy: <@${message.author.id}>\nReason: ${reason}`,
                    allowedMentions: { parse: [] }
                });
            }

        } catch (error) {
            console.error(error);
            return message.reply({
                content: 'I was unable to kick the user. Please check if the ID is correct and I have the necessary permissions.',
                allowedMentions: { parse: [] }
            });
        }
    }
};
