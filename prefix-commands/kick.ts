import configManager from '../utils/ConfigManager';
import { EmbedBuilder } from 'discord.js';

module.exports = {
    name: 'kick',
    description: 'Kicks a user from the server.',

    /**
     * @param {import('discord.js').Message} message
     * @param {string[]} args
     */
    async execute(message: any, args: any[]) {
        const guild = message.guild;
        const config = await configManager.getOrCreateConfig(guild);
        const requiredRoles: string[] = config.permissions.moderatorRoles || [];
        const hasRequiredRole = message.member.roles.cache.some((role: any) => requiredRoles.includes(role.id));

        if (!hasRequiredRole) {
            return message.reply({
                content: 'You do not have permission to use this command.',
                allowedMentions: { parse: [] }
            });
        }

        const userId = args[0]?.replace(/[<@!>]/g, '');
        if (!userId) {
            return message.reply({
                content: 'Please provide a user mention or ID to kick.',
                allowedMentions: { parse: [] }
            });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            const user = await message.guild.members.fetch(userId);
            if (!user) {
                return message.reply({
                    content: 'Could not find this user in the server.',
                    allowedMentions: { parse: [] }
                });
            }

            if (user.roles.cache.some((r: any) => requiredRoles.includes(r.id))) {
                const embed = new EmbedBuilder()
                    .setColor('Random')
                    .setDescription('You cannot kick mods. <a:AK_KannaPiano:1370142206739877959>');
                return message.reply({ embeds: [embed] });
            }

            if (!user.kickable) {
                return message.reply({
                    content: 'I cannot kick this user. They might have a higher role or permissions.',
                    allowedMentions: { parse: [] }
                });
            }

            try {
                await user.send(`You have been __**KICKED**__ from **${message.guild.name}** for the following reason: ${reason}`);
            } catch {
                const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
                if (logChannel?.isTextBased()) {
                    logChannel.send({
                        content: `Could not send DM to <@${userId}> before kick.`,
                        allowedMentions: { parse: [] }
                    });
                }
            }

            await user.kick(reason);
            await message.channel.send({
                content: `<@${userId}> has been __**KICKED**__.[⠀](https://tenor.com/view/kicked-persona-persona5-gif-25017260)`,
                allowedMentions: { parse: [] }
            });

            const logChannel = message.guild.channels.cache.get(config.logging.logChannelId || '');
            if (logChannel?.isTextBased()) {
                logChannel.send({
                    content: `🔨 <@${userId}> was kicked by <@${message.author.id}> for: ${reason}`,
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
