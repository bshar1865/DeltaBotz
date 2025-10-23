import { TextChannel, DMChannel, NewsChannel, Guild } from 'discord.js';
import idclass from './idclass';

interface ErrorLogOptions {
    error: Error | string;
    source?: string;
    additionalInfo?: Record<string, any>;
}

function formatError(error: Error | string): string {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}\n${error.stack || ''}`;
    }
    return error.toString();
}

function formatAdditionalInfo(info?: Record<string, any>): string {
    if (!info) return '';
    try {
        return '\nAdditional Info:\n' + JSON.stringify(info, null, 2);
    } catch {
        return '\nAdditional Info: [Could not stringify info]';
    }
}

export async function logErrorToChannel(options: ErrorLogOptions, client?: any, guild?: Guild): Promise<void> {
    const { error, source = 'Unknown', additionalInfo } = options;

    try {
        if (!client) {
            console.error('No client provided for error logging');
            return;
        }

        const logChannel = await client.channels.fetch(idclass.channelErrorLogs());
        
        if (!logChannel) {
            console.error('Failed to fetch log channel - channel not found');
            return;
        }
        
        if (!(logChannel instanceof TextChannel || logChannel instanceof DMChannel || logChannel instanceof NewsChannel)) {
            console.error('Invalid log channel type:', logChannel.constructor.name);
            return;
        }

        const serverName = guild?.name || 'Unknown Server';
        const serverId = guild?.id || 'unknown';
        const errorMessage = [
            `**Error in:** \`${source}\``,
            `**Server:** ${serverName} (${serverId})`,
            '```',
            formatError(error),
            formatAdditionalInfo(additionalInfo),
            '```'
        ].join('\n');

        if (errorMessage.length > 2000) {
            await logChannel.send(`**Error in:** \`${source}\` (Error too long, check console logs)`);
            console.error('Full error:', error);
            if (additionalInfo) console.error('Additional info:', additionalInfo);
        } else {
            await logChannel.send(errorMessage);
        }
    } catch (err) {
        console.error('Failed to log error to channel:', err);
        console.error('Original error:', error);
        console.error('Channel ID attempted:', idclass.channelErrorLogs());
        console.error('Client ready state:', client?.isReady());
    }
}

// Export a convenient function for direct use
export const logError = (error: Error | string, source?: string, additionalInfo?: Record<string, any>, client?: any, guild?: Guild) => {
    return logErrorToChannel({ error, source, additionalInfo }, client, guild);
};

