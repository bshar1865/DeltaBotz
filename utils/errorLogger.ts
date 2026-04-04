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

function isIgnorableError(error: Error | string): boolean {
    const anyErr = error as any;
    const code = anyErr?.code;
    // Discord API error codes to ignore
    if (
        code === 50001 || // Missing Access
        code === 10003 || // Unknown Channel
        code === 50013 || // Missing Permissions
        code === 10008 || // Unknown Message
        code === 10062 || // Unknown Interaction
        code === 40060 || // Interaction already acknowledged
        code === 20028    // Rate limited
    ) {
        return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    return /Missing Access|Unknown Channel|Missing Permissions|Unknown Message|Unknown Interaction|Interaction has already been acknowledged|rate limited|timeout|timed out|ETIMEDOUT/i.test(message);
}

export async function logErrorToChannel(
    options: ErrorLogOptions,
    client?: any,
    guild?: Guild
): Promise<void> {
    const { error, source = 'Unknown', additionalInfo } = options;

    try {
        if (isIgnorableError(error)) return;

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

        // Robust guild detection
        let serverName = 'Unknown Server';
        let serverId = 'unknown';
        if (guild) {
            serverName = guild.name;
            serverId = guild.id;
        } else if (additionalInfo?.guildId) {
            const fetchedGuild = await client.guilds.fetch(additionalInfo.guildId).catch(() => null);
            if (fetchedGuild) {
                serverName = fetchedGuild.name;
                serverId = fetchedGuild.id;
            }
        }
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

// Convenience wrapper
export const logError = (
    error: Error | string,
    source?: string,
    additionalInfo?: Record<string, any>,
    client?: any,
    guild?: Guild
) => logErrorToChannel({ error, source, additionalInfo }, client, guild);
