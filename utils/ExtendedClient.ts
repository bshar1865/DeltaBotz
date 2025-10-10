import { Client, Collection } from 'discord.js';

export interface ExtendedClient extends Client {
  prefixCommands: Collection<string, any>;
  slashCommands: Collection<string, any>;
}
