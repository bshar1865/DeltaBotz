import path from 'path';
import { client } from '../client';
import { Event } from '../types';
import { getAllFiles } from '../utils/fileUtils';

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
