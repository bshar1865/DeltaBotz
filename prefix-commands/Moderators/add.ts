import {
    Message,
    TextChannel,
    GuildMember,
    ChannelType
} from 'discord.js';
import idclass from '../../utils/idclass';
import configManager from '../../utils/ConfigManager';
export default {
    name: 'add',
    description: 'Gives a user access to the current channel.',
    
    requiredRoles: [],

    async execute(message: Message, args: string[]) {
        if (!message.guild || !message.member) return;

        const guildConfig = await configManager.getOrCreateConfig(message.guild);
        
        // Owner bypass
        const isOwner = message.author.id === guildConfig.permissions.ownerId || message.author.id === idclass.ownershipID();
        const hasRequiredRole = isOwner || message.member.roles.cache.some(role =>
            (guildConfig.permissions.moderatorRoles || []).includes(role.id)
        );

        if (!hasRequiredRole) {
            await message.reply({
                content: 'You do not have permission to use this command.',
                allowedMentions: { parse: [] }
            });
            return;
        }

        const user: GuildMember | undefined = message.mentions.members?.first();
        if (!user) {
            await message.reply({
                content: 'Please mention a valid user.',
                allowedMentions: { parse: [] }
            });
            return;
        }

        if (message.channel.type !== ChannelType.GuildText) return;

        const channel = message.channel as TextChannel;
        const restrictedCategories: string[] = [];
        const isRestricted = restrictedCategories.includes(channel.parentId ?? '');

        if (isRestricted) {
            await channel.send({
                content: 'Sus.',
                allowedMentions: { parse: [] }
            });
            return;
        }

        try {
            await channel.permissionOverwrites.edit(user, {
                ViewChannel: true,
                SendMessages: true
            });

            await channel.send({
                content: `Added <@${user.id}> to the channel successfully.`,
                allowedMentions: { parse: [] }
            });

            const logChannel = message.guild.channels.cache.get(guildConfig.logging.logChannelId || '');
            if (logChannel?.type === ChannelType.GuildText) {
                await (logChannel as TextChannel).send({
                    content: `<@${user.id}> has been __**ADDED**__ to ${channel.name} by <@${message.author.id}>.`,
                    allowedMentions: { parse: [] }
                });
            }
        } catch (error) {
            console.error(error);
            await channel.send({
                content: 'I cannot add this person to this channel.',
                allowedMentions: { parse: [] }
            });
        }
    }
};
