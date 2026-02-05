import fs from 'fs';
import path from 'path';
import { client } from '../client';
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';

function getAllFiles(dir: string, ext = '.ts'): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) results = results.concat(getAllFiles(fullPath, ext));
        else if (item.isFile() && item.name.endsWith(ext)) results.push(fullPath);
    }
    return results;
}

export async function loadSlashCommands(): Promise<RESTPostAPIChatInputApplicationCommandsJSONBody[]> {
    const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    const commandsPath = path.join(__dirname, '../slash-commands');
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
