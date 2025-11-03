import fs from 'fs';
import path from 'path';
import { client } from '../client';
import { Command } from '../types';

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

export async function loadPrefixCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, '../prefix-commands');
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
