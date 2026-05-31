import path from 'path';
import { client } from '../client';
import { Command } from '../types';
import { getAllFiles } from '../utils/fileUtils';

export async function loadPrefixCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, '../commands/prefix');
    const commandFiles = getAllFiles(commandsPath);

    console.log('Loading prefix commands...');
    for (const file of commandFiles) {
        try {
            const command = await import(file);
            if (command.default && command.default.name) {
                // Mark commands from Moderators folder as moderator commands, except whitelist
                const isModeratorCommand = (file.includes(path.sep + 'Moderators' + path.sep) || file.includes('/Moderators/')) && path.basename(file) !== 'whitelist.ts';
                if (isModeratorCommand) {
                    command.default.isModeratorCommand = true;
                }
                client.prefixCommands.set(command.default.name, command.default);
            }
        } catch (error) {
            console.error(`Error loading prefix command ${file}:`, error);
        }
    }
    console.log(`Loaded ${client.prefixCommands.size} prefix commands!`);
}
