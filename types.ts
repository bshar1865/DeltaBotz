import { 
    ClientEvents, 
    ButtonInteraction, 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    SlashCommandSubcommandsOnlyBuilder,
    PermissionResolvable
} from 'discord.js';

export interface Command {
    name?: string;
    description?: string;
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (...args: any[]) => Promise<void>;
    buttonHandler?: (interaction: ButtonInteraction) => Promise<void>;
    isModeratorCommand?: boolean;
    requiredUserPermissions?: PermissionResolvable[];
}

export interface Event {
    name: keyof ClientEvents;
    execute: (...args: any[]) => Promise<void>;
    once?: boolean;
}

// Re-export config types for convenience
export * from './types/config';
