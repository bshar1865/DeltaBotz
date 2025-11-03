import { Client, Collection, GatewayIntentBits, Partials, ClientOptions } from 'discord.js';
import { Command } from './types';

export interface ExtendedClient extends Client {
    prefixCommands: Collection<string, Command>;
    slashCommands: Collection<string, Command>;
}

const clientConfig: ClientOptions = {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
};

export const client = new Client(clientConfig) as ExtendedClient;
client.prefixCommands = new Collection();
client.slashCommands = new Collection();
