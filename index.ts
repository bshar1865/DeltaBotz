import 'dotenv/config';
import {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
    Partials,
    ClientOptions
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { Command, Event } from './types';
import { logError } from './utils/errorLogger';

// Client configuration
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

// Extend Discord Client with custom properties
export interface ExtendedClient extends Client {
    prefixCommands: Collection<string, Command>;
    slashCommands: Collection<string, Command>;
}


// Create the bot client
export const client = new Client(clientConfig) as ExtendedClient;

// Initialize collections
client.prefixCommands = new Collection();
client.slashCommands = new Collection();

/** Recursively read all .ts files in a folder and subfolders */
function getAllFiles(dir: string, ext = '.ts'): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, ext));
        } else if (item.isFile() && item.name.endsWith(ext)) {
            results.push(fullPath);
        }
    }
    return results;
}

async function loadPrefixCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, 'prefix-commands');
    const commandFiles = getAllFiles(commandsPath);

    console.log('Loading prefix commands...');
    for (const file of commandFiles) {
        try {
            const command = await import(file);
            if (command.default && command.default.name) {
                client.prefixCommands.set(command.default.name, command.default);
            }
        } catch (error) {
            console.error(`Error loading prefix command ${file}:`, error);
        }
    }
    console.log(`Loaded ${client.prefixCommands.size} prefix commands!`);
}

async function loadSlashCommands(): Promise<Command[]> {
    const commands: Command[] = [];
    const commandsPath = path.join(__dirname, 'slash-commands');
    const commandFiles = getAllFiles(commandsPath);

    console.log('Loading slash commands...');
    for (const file of commandFiles) {
        try {
            const command = await import(file);
            if (command.default && command.default.data?.name) {
                client.slashCommands.set(command.default.data.name, command.default);
                commands.push(command.default.data.toJSON());
            }
        } catch (error) {
            console.error(`Error loading slash command ${file}:`, error);
        }
    }
    console.log(`Loaded ${commands.length} slash commands!`);
    return commands;
}

async function loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = getAllFiles(eventsPath);

    console.log('Loading events...');
    for (const file of eventFiles) {
        try {
            const event = (await import(file)) as { default: Event };
            const listener = (...args: any[]) => event.default.execute(...args, client);

            if (event.default.once) {
                client.once(event.default.name, listener);
            } else {
                client.on(event.default.name, listener);
            }
        } catch (error) {
            console.error(`Error loading event ${file}:`, error);
        }
    }
    console.log(`Loaded ${eventFiles.length} events!`);
}

async function registerSlashCommands(commands: Command[]): Promise<void> {
    if (!process.env.DISCORD_TOKEN) {
        throw new Error('Missing DISCORD_TOKEN in .env!');
    }
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: commands }
        );
        console.log('Successfully registered slash commands!');
    } catch (error) {
        console.error('Error registering slash commands:', error);
        throw error;
    }
}

async function init() {
    try {
        console.log('\nInitializing DeltaBotz...\n');

        await loadPrefixCommands();
        const slashCommands = await loadSlashCommands();
        await loadEvents();

        await client.login(process.env.DISCORD_TOKEN);
        await registerSlashCommands(slashCommands);

        console.log('\nDeltaBotz is ready!\n');
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        process.exit(1);
    }
}

process.on('unhandledRejection', async (error: any) => {
    console.error('Unhandled promise rejection:', error);
    try { await logError(error instanceof Error ? error : String(error), 'unhandledRejection', undefined, client as any); } catch (logErr) {
        console.error('Failed to log unhandled rejection:', logErr);
    }
});

process.on('uncaughtException', async (error: any) => {
    console.error('Uncaught exception:', error);
    try { await logError(error instanceof Error ? error : String(error), 'uncaughtException', undefined, client as any); } catch (logErr) {
        console.error('Failed to log uncaught exception:', logErr);
    }
    process.exit(1);
});

init();
