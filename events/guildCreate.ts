import { Client, Events, Guild, TextChannel, DMChannel, NewsChannel, EmbedBuilder } from 'discord.js';
import { Event } from '../types';
import idclass from '../utils/idclass';

const event: Event = {
  name: Events.GuildCreate,
  async execute(guild: Guild, client: Client) {
    try {
      const logChannel = await client.channels.fetch(idclass.channelErrorLogs()).catch(() => null);
      if (logChannel && (logChannel instanceof TextChannel || logChannel instanceof DMChannel || logChannel instanceof NewsChannel)) {
        // Fetch full guild data to get banner
        const fullGuild = await guild.fetch().catch(() => guild);
        
        const embed = new EmbedBuilder()
          .setTitle(fullGuild.name)
          .setColor('#00ff00')
          .setTimestamp();

        // Set server icon as thumbnail
        if (fullGuild.icon) {
          embed.setThumbnail(fullGuild.iconURL({ size: 512 }) || '');
        }

        // Set server banner as image if available
        if (fullGuild.banner) {
          const bannerUrl = fullGuild.banner.startsWith('a_')
            ? `https://cdn.discordapp.com/banners/${fullGuild.id}/${fullGuild.banner}.gif?size=512`
            : `https://cdn.discordapp.com/banners/${fullGuild.id}/${fullGuild.banner}.png?size=512`;
          embed.setImage(bannerUrl);
        }

        await logChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Failed to log guild add:', err);
    }
  },
};

export default event;

