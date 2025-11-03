import { REST, Routes } from 'discord.js';
import { client } from './client';
import { Command } from './types';

export async function registerSlashCommands(commands: Command[]): Promise<void> {
    if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN in .env!');

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
