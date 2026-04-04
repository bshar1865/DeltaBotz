import 'dotenv/config';
import { client } from './client';
import { loadPrefixCommands } from './loaders/loadPrefixCommands';
import { loadEvents } from './loaders/loadEvents';
import { loadSlashCommands } from './loaders/loadSlashCommands';
import { registerSlashCommands } from './registerSlashCommands';
import { logError } from './utils/errorLogger';

function isTimeoutError(error: any): boolean {
    const text = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    return /timeout|timed out|ETIMEDOUT|RequestTimeout/i.test(text);
}

async function init() {
    try {
        console.log('Initializing DeltaBotz...');
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Missing DISCORD_TOKEN in .env');
        }
        await loadPrefixCommands();
        const slashCommands = await loadSlashCommands();
        await loadEvents();

        await client.login(process.env.DISCORD_TOKEN);
        await registerSlashCommands(slashCommands);

        console.log('DeltaBotz is ready!');
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        process.exit(1);
    }
}

process.on('unhandledRejection', async (error: any) => {
    console.error('Unhandled promise rejection:', error);
    if (isTimeoutError(error)) return;
    try { await logError(error instanceof Error ? error : String(error), 'unhandledRejection', undefined, client as any); } catch {}
});

process.on('uncaughtException', async (error: any) => {
    console.error('Uncaught exception:', error);
    if (isTimeoutError(error)) return;
    try { await logError(error instanceof Error ? error : String(error), 'uncaughtException', undefined, client as any); } catch {}
    process.exit(1);
});

init();
