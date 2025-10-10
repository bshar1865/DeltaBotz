import {
  Client,
  Events,
  TextChannel,
  DMChannel,
  NewsChannel
} from 'discord.js';
import idclass from '../utils/idclass';

const startTime = Date.now();

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    const endTime = Date.now();
    const startupTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`Logged in as ${client.user!.tag}`);
    console.log(`Startup time: ${startupTime}s`);


    const logChannel = await client.channels.fetch(idclass.channelErrorLogs()).catch(() => null);
    if (
      logChannel &&
      (logChannel instanceof TextChannel ||
        logChannel instanceof DMChannel ||
        logChannel instanceof NewsChannel)
    ) {
      await logChannel.send(
        `${client.user!.tag} has been logged in successfully\nStartup Time: \`${startupTime}s\``
      );
    }


    
  }
};
