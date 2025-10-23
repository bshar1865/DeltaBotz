import { Client, Events, Guild, TextChannel, DMChannel, NewsChannel } from 'discord.js';
import { Event } from '../types';
import idclass from '../utils/idclass';

const event: Event = {
  name: Events.GuildCreate,
  async execute(guild: Guild, client: Client) {
    try {
      const logChannel = await client.channels.fetch(idclass.channelErrorLogs()).catch(() => null);
      if (logChannel && (logChannel instanceof TextChannel || logChannel instanceof DMChannel || logChannel instanceof NewsChannel)) {
        await logChannel.send(`Added to server: **${guild.name}** (${guild.id})`);
      }
    } catch (err) {
      console.error('Failed to log guild add:', err);
    }
  },
};

export default event;

