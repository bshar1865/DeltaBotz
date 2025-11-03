import fs from 'fs';
import path from 'path';
import { client } from '../client';
import { Event } from '../types';

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

export async function loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = getAllFiles(eventsPath);

    console.log('Loading events...');
    for (const file of eventFiles) {
        try {
            const event = (await import(file)) as { default: Event };
            const listener = (...args: any[]) => event.default.execute(...args, client);

            if (event.default.once) client.once(event.default.name, listener);
            else client.on(event.default.name, listener);
        } catch (error) {
            console.error(`Error loading event ${file}:`, error);
        }
    }
    console.log(`Loaded ${eventFiles.length} events!`);
}
