import { 
    ClientEvents, 
    CommandInteraction, 
    ButtonInteraction, 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';

export interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    buttonHandler?: (interaction: ButtonInteraction) => Promise<void>;
}

export interface Event {
    name: keyof ClientEvents;
    execute: (...args: any[]) => Promise<void>;
    once?: boolean;
}

// Re-export config types for convenience
export * from './types/config';