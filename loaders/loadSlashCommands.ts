import path from 'path';
import { client } from '../client';
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { getAllFiles } from '../utils/fileUtils';

export async function loadSlashCommands(): Promise<RESTPostAPIChatInputApplicationCommandsJSONBody[]> {
    const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    const commandsPath = path.join(__dirname, '../commands/slash');
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
