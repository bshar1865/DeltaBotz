import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import os from 'os';

function formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
}

function formatUptime(uptime: number): string {
    const totalSeconds = Math.floor(uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
}

function formatNumber(value: number): string {
    return value.toLocaleString('en-US');
}

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('View bot details, performance, and useful links.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const bot = interaction.client;

        // System stats
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = `${formatBytes(usedMem)} / ${formatBytes(totalMem)}`;
        // Bot stats
        const guildCount = bot.guilds.cache.size;
        
        const mainEmbed = new EmbedBuilder()
            .setTitle('DeltaBotz')
            .setDescription('A moderation-focused Discord bot with setup tools and server utilities.')
            .setThumbnail(bot.user?.displayAvatarURL() || null)
            .addFields(
                { 
                    name: 'Performance',
                    value: [
                        `**Uptime:** ${formatUptime(bot.uptime ?? 0)}`,
                        `**Latency:** ${Math.round(bot.ws.ping)}ms`,
                        `**Memory:** ${memoryUsage}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Reach',
                    value: `**Servers:** ${formatNumber(guildCount)}`,
                    inline: true
                },
                {
                    name: 'Project',
                    value: [
                        '**GitHub:** https://github.com/bshar1865/DeltaBotz'
                    ].join('\n')
                },
                {
                    name: 'Credits',
                    value: [
                        '**Developer:** Delta Team',
                        '**Hosted On:** CloudPanel Server (thanks to moonpower)'
                    ].join('\n')
                },
                {
                    name: 'Support',
                    value: [
                        `**Support Server:** ${process.env.SUPPORT_SERVER_URL || 'https://discord.gg/u3jQjYmBby'}`
                    ].join('\n')
                }
            )
            .setColor('Random')
            .setTimestamp()
            .setFooter({ text: 'Tip: Use /setup to configure features' });

        await interaction.editReply({ embeds: [mainEmbed] });
    },
};
