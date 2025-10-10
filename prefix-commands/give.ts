import { Message, Guild, TextChannel } from 'discord.js';
import configManager from '../utils/ConfigManager';

module.exports = {
    name: 'giver',
    description: 'Gives specified roles to a mentioned user or by user ID.',

    /**
     * @param {import('discord.js').Message} message
     * @param {string[]} args
     */
    async execute(message: Message, args: string[] ) {
        const config = await configManager.getOrCreateConfig(message.guild as Guild);
        const requiredRoles = config.permissions.moderatorRoles || [];
        const memberRoles = message.member?.roles?.cache;

        if (!memberRoles || !memberRoles.some((role: { id: string; }) => requiredRoles.includes(role.id))) {
            return message.reply({
                content: 'You do not have permission to use this command.',
                allowedMentions: { parse: [] }
            });
        }

        if (args.length < 2) {
            return message.reply({
                content: 'Usage: `giver <@user|userID> <roleID1> [roleID2 ...]`',
                allowedMentions: { parse: [] }
            });
        }

        let targetMember;
        const userId = (args[0] as string).replace(/[<@!>]/g, '');
        try {
            targetMember = await message.guild!.members.fetch(userId);
        } catch {
            return message.reply({
                content: 'Could not find the specified user.',
                allowedMentions: { parse: [] }
            });
        }

        const roleIds = args.slice(1);
        const validRoles = [];
        const rejectedRoles = [];

        for (const roleId of roleIds) {
            const role = message.guild!.roles.cache.get(roleId);
            if (!role || requiredRoles.includes(role.id)) {
                rejectedRoles.push(roleId);
            } else {
                validRoles.push(role);
            }
        }

        try {
            if (validRoles.length > 0) {
                await targetMember.roles.add(validRoles.map(r => r.id));
                await message.reply({
                    content: `Added roles to <@${targetMember.id}>: ${validRoles.map(r => r.name).join(', ')}`,
                    allowedMentions: { parse: [] }
                });

                const logChannel = message.guild!.channels.cache.get(config.logging.logChannelId || '');
                if (logChannel?.isTextBased()) {
                    logChannel.send({
                        content: `<@${message.author.id}> added roles (${validRoles.map(r => r.name).join(', ')}) to <@${targetMember.id}>.`,
                        allowedMentions: { parse: [] }
                    });
                }
            } else {
                await message.reply({
                    content: '⚠️ No valid roles to add.',
                    allowedMentions: { parse: [] }
                });
            }

            if (rejectedRoles.length > 0) {
                await message.reply({
                    content: `Invalid or restricted role IDs: ${rejectedRoles.join(', ')}`,
                    allowedMentions: { parse: [] }
                });
            }
        } catch (err) {
            console.error(err);
            await message.reply({
                content: 'An error occurred while assigning roles.',
                allowedMentions: { parse: [] }
            });

            const logChannel = message.guild!.channels.cache.get(config.logging.logChannelId || '');
            if (logChannel?.isTextBased()) {
                logChannel.send({
                    content: `Error assigning roles to <@${targetMember.id}> by <@${message.author.id}>`,
                    allowedMentions: { parse: [] }
                });
            }
        }
    }
};
