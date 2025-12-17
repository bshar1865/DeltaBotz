import {
    Message,
    PermissionsBitField,
    EmbedBuilder,
    TextChannel,
    ChannelType,
  } from 'discord.js';
import configManager from '../../utils/ConfigManager';

  module.exports = {
    name: 'mute',
    description: 'Times out a user for a specified duration or removes the timeout if no duration is provided.',
    async execute(message: Message, args: string[]) {
      const config = await configManager.getOrCreateConfig(message.guild!);
      const requiredRoles = config.permissions.moderatorRoles || [];
      const hasRequiredRole = message.member?.roles.cache.some(role =>
        requiredRoles.includes(role.id)
      );
  
      if (!hasRequiredRole) {
        return message.reply('You do not have permission to use this command.');
      }
  
      const member = message.mentions.members?.first();
      if (!member) {
        return message.reply('Please mention a user to timeout or untimeout.');
      }
  
      const protectedRoles = requiredRoles;
      if (member.roles.cache.some(role => protectedRoles.includes(role.id))) {
        const embed = new EmbedBuilder()
          .setColor('Random')
          .setDescription('You cannot mute mods <a:AK_KannaPiano:1370142206739877959> ');
        return message.reply({ embeds: [embed] });
      }
  
      const duration = args[1];
      const reason = args.slice(2).join(' ') || 'No reason provided';
      const logChannel = message.guild?.channels.cache.get(config.logging.logChannelId || '') as TextChannel;
  
      try {
        if (duration) {
          const durationMs = parseDuration(duration);
          if (durationMs === null) {
            return message.reply('Invalid duration format. Use formats like `10m`, `1h`, `1d`.');
          }
  
          await member.timeout(durationMs, reason);
          await message.reply({
            content: `<@${member.id}> has been __**MUTED**__`,
            allowedMentions: { parse: [] },
          });
  
          try {
            await member.send(
              `You have been __**MUTED**__ in **${message.guild?.name}** for **${duration}** due to: **${reason}**`
            );
          } catch {
            if (logChannel?.type === ChannelType.GuildText) {
              await logChannel.send({
                content: `Could not send DM to <@${member.id}> about the mute.`,
                allowedMentions: { parse: [] },
              });
            }
          }
  
          if (logChannel?.type === ChannelType.GuildText) {
            await logChannel.send({
              content: `<@${member.id}> has been __**MUTED**__ for ${duration} by <@${message.author.id}>. Reason: ${reason}`,
              allowedMentions: { parse: [] },
            });
          }
  
          setTimeout(async () => {
            try {
              await member.send(`Your mute in **${message.guild?.name}** has ended.`);
            } catch {
              if (logChannel?.type === ChannelType.GuildText) {
                await logChannel.send({
                  content: `Could not send DM to <@${member.id}> after the mute ended.`,
                  allowedMentions: { parse: [] },
                });
              }
            }
          }, durationMs);
        } else {
          await member.timeout(null, reason);
          await message.reply({
            content: `<@${member.id}> has been __**UNMUTED**__`,
            allowedMentions: { parse: [] },
          });
  
          if (logChannel?.type === ChannelType.GuildText) {
            await logChannel.send({
              content: `<@${member.id}> has been __**UNMUTED**__ by <@${message.author.id}>. Reason: ${reason}`,
              allowedMentions: { parse: [] },
            });
          }
        }
      } catch (err) {
        console.error(err);
        message.reply('An error occurred while trying to mute or unmute the user.');
      }
    },
  };
  
  function parseDuration(duration: string): number | null {
    const regex = /^(\d+)([smhd])$/;
    const match = duration.match(regex);
    if (!match) return null;
  
    const value = parseInt(match[1]);
    const unit = match[2];
  
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return null;
    }
  }
  