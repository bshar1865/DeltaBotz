import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, version as discordJsVersion } from 'discord.js';
import os from 'os';

// Simplified info: no git repo or host device details

// CPU usage removed per request

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

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Displays detailed bot information and system stats.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const bot = interaction.client;

        // System stats
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = `${formatBytes(usedMem)} / ${formatBytes(totalMem)}`;
        // CPU usage removed; keep memory stats
        
        const mainEmbed = new EmbedBuilder()
            .setTitle('DeltaBotz')
            .setDescription('A powerful, modern Discord bot for your servers.')
            .setThumbnail(bot.user?.displayAvatarURL() || null)
            .addFields(
                { 
                    name: 'Status',
                    value: [
                        `**Uptime:** ${formatUptime(bot.uptime!)}`,
                        `**Latency:** ${Math.round(bot.ws.ping)}ms`,
                        `**Memory:** ${memoryUsage}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Tech',
                    value: [
                        `**Language:** TypeScript`,
                        `**Runtime:** Node.js ${process.version}`,
                        `**Discord.js:** v${discordJsVersion}`,
                        `**Database:** better-sqlite3`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Repository',
                    value: [
                        `**Repository:** [GitHub](https://github.com/bshar1865/DeltaBotz)`
                    ].join('\n')
                },
                {
                    name: 'Credits',
                    value: [
                        '**Developer:** Delta Team',
                        '**Hosted On:** CloudPanel Server (Thanks to @moonpower.)',
                        '**Support:** [Star us on GitHub!](https://github.com/bshar1865/DeltaBotz)'
                    ].join('\n')
                }
            )
            .setColor('#00b3ff')
            .setTimestamp()
            .setFooter({ text: 'Tip: Use /setup to configure features' });

        await interaction.editReply({ embeds: [mainEmbed] });
    },
};
