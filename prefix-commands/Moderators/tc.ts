import { Message, MessageCollector, TextChannel, DMChannel, NewsChannel } from 'discord.js';
import idclass from '../../utils/idclass';
import configManager from '../../utils/ConfigManager';
import { getGuildDB } from '../../utils/db';
import { ExtendedClient } from '../../client';

interface TempCommand {
  name: string;
  response: string;
  creatorId: string;
  creatorTag: string;
  createdAt: string;
}

// Store active collectors: userId -> collector
const activeCollectors = new Map<string, MessageCollector>();

export default {
  name: 'tc',
  description: 'Create and manage temporary commands. Use `.tc` to create, `.tc remove <name>` to remove, `.tc list` to list all temp commands.',

  checkPermission(message: Message, config: any): boolean {
    // Owner bypass
    if (message.author.id === config.permissions.ownerId || message.author.id === idclass.ownershipID()) return true;
    
    // Check if user has any of the required roles
    const allModRoles = config.permissions.moderatorRoles;
    
    return message.member?.roles.cache.some(role => 
      allModRoles.includes(role.id)
    ) || false;
  },

  async execute(message: Message, args: string[], client: ExtendedClient) {
    if (!message.guild) {
      return message.reply({
        content: 'This command can only be used in a server.',
        allowedMentions: { parse: [] }
      });
    }

    const guildId = message.guild.id;
    const gdb = getGuildDB(guildId);
    const config = await configManager.getOrCreateConfig(message.guild);

    // Get all temp commands
    const getAllTempCommands = async (): Promise<TempCommand[]> => {
      const commands = await gdb.get<TempCommand[]>('tempCommands') || [];
      return commands;
    };

    // Save all temp commands
    const saveTempCommands = async (commands: TempCommand[]): Promise<void> => {
      await gdb.set('tempCommands', commands);
    };

    // Find temp command by name (case-insensitive)
    const findTempCommand = (commands: TempCommand[], name: string): TempCommand | undefined => {
      return commands.find(c => c.name.toLowerCase() === name.toLowerCase());
    };

    // Remove subcommand
    if (args[0]?.toLowerCase() === 'remove') {
      const hasPermission = this.checkPermission(message, config);
      if (!hasPermission) {
        return message.reply({
          content: 'You do not have permission to use this command.',
          allowedMentions: { parse: [] }
        });
      }

      if (!args[1]) {
        return message.reply({
          content: 'Usage: `.tc remove <name>`\nExample: `.tc remove welcome`',
          allowedMentions: { parse: [] }
        });
      }

      const commandName = args[1].toLowerCase();
      const commands = await getAllTempCommands();
      const command = findTempCommand(commands, commandName);

      if (!command) {
        return message.reply({
          content: `Temporary command "${commandName}" not found.`,
          allowedMentions: { parse: [] }
        });
      }

      const filteredCommands = commands.filter(c => c.name.toLowerCase() !== commandName);
      await saveTempCommands(filteredCommands);

      return message.reply({
        content: `Temporary command "${command.name}" has been removed.`,
        allowedMentions: { parse: [] }
      });
    }

    // List subcommand
    if (args[0]?.toLowerCase() === 'list') {
      const commands = await getAllTempCommands();
      
      if (commands.length === 0) {
        return message.reply({
          content: 'No temporary commands have been created yet.\n\nModerators can use `.tc` to create one.',
          allowedMentions: { parse: [] }
        });
      }

      const commandList = commands.map(cmd => `- ${cmd.name}`).join('\n');
      return message.reply({
        content: `**Temporary Commands**\nUse \`.<command name>\` to execute a temporary command.\n\n${commandList}\n\nTotal: ${commands.length} command${commands.length === 1 ? '' : 's'}`,
        allowedMentions: { parse: [] }
      });
    }

    // Create new temp command (no args or "create")
    const hasPermission = this.checkPermission(message, config);
    if (!hasPermission) {
      return message.reply({
        content: 'You do not have permission to use this command.',
        allowedMentions: { parse: [] }
      });
    }

    // Check if user already has an active collector
    if (activeCollectors.has(message.author.id)) {
      return message.reply({
        content: 'You already have an active command creation process. Please complete it first.',
        allowedMentions: { parse: [] }
      });
    }

    // Start interactive creation
    await message.reply({
      content: '**Create Temporary Command**\n\n**Command name?**\n\nReply with the name for your temporary command (e.g., `welcome`, `rules`). **Make sure they are lowercase**\n\nType `cancel` to cancel.',
      allowedMentions: { parse: [] }
    });

    // Create collector for command name
    const nameCollector = new MessageCollector(message.channel as TextChannel, {
      filter: (msg) => msg.author.id === message.author.id && msg.guildId === guildId,
      time: 60000, // 60 seconds
      max: 1
    });

    activeCollectors.set(message.author.id, nameCollector);

    nameCollector.on('collect', async (msg: Message) => {
      if (msg.content.toLowerCase() === 'cancel') {
        activeCollectors.delete(message.author.id);
        nameCollector.stop('cancelled');
        return msg.reply({
          content: 'Command creation cancelled.',
          allowedMentions: { parse: [] }
        });
      }

      const commandName = msg.content.trim().toLowerCase();

      // Validate command name
      if (!commandName || commandName.length === 0) {
        return msg.reply({
          content: 'Invalid command name. Please provide a valid name.',
          allowedMentions: { parse: [] }
        });
      }

      if (commandName.length > 30) {
        return msg.reply({
          content: 'Command name must be 30 characters or less.',
          allowedMentions: { parse: [] }
        });
      }

      // Check if it conflicts with existing commands
      const existingCommands = await getAllTempCommands();
      if (findTempCommand(existingCommands, commandName)) {
        return msg.reply({
          content: `A temporary command with the name "${commandName}" already exists. Use \`.tc remove ${commandName}\` to remove it first.`,
          allowedMentions: { parse: [] }
        });
      }

      // Check if it conflicts with built-in commands
      const builtInCommand = client.prefixCommands.get(commandName);
      if (builtInCommand) {
        return msg.reply({
          content: `"${commandName}" is already a built-in command. Please choose a different name.`,
          allowedMentions: { parse: [] }
        });
      }

      // Ask for response
      await msg.reply({
        content: `**Create Temporary Command**\n\n**Command name:** \`${commandName}\`\n\n**What do you want this command to say?**\n\nReply with the response text. Type \`cancel\` to cancel.`,
        allowedMentions: { parse: [] }
      });

      // Create collector for response
      const responseCollector = new MessageCollector(message.channel as TextChannel, {
        filter: (responseMsg) => responseMsg.author.id === message.author.id && responseMsg.guildId === guildId,
        time: 120000, // 2 minutes
        max: 1
      });

      activeCollectors.set(message.author.id, responseCollector);

      responseCollector.on('collect', async (responseMsg: Message) => {
        if (responseMsg.content.toLowerCase() === 'cancel') {
          activeCollectors.delete(message.author.id);
          responseCollector.stop('cancelled');
          return responseMsg.reply({
            content: 'Command creation cancelled.',
            allowedMentions: { parse: [] }
          });
        }

        const responseText = responseMsg.content.trim();

        if (!responseText || responseText.length === 0) {
          return responseMsg.reply({
            content: 'Invalid response. Please provide a response text.',
            allowedMentions: { parse: [] }
          });
        }

        if (responseText.length > 2000) {
          return responseMsg.reply({
            content: 'Response text must be 2000 characters or less.',
            allowedMentions: { parse: [] }
          });
        }

        // Save the temp command
        const newCommand: TempCommand = {
          name: commandName,
          response: responseText,
          creatorId: message.author.id,
          creatorTag: message.author.tag,
          createdAt: new Date().toISOString()
        };

        existingCommands.push(newCommand);
        await saveTempCommands(existingCommands);
        activeCollectors.delete(message.author.id);

        await responseMsg.reply({
          content: `**Temporary Command Created**\n\n**Command:** \`.${commandName}\`\n**Response:** ${responseText}\n\nCreated by ${message.author.tag}`,
          allowedMentions: { parse: [] }
        });
        responseCollector.stop('completed');
      });

      responseCollector.on('end', (collected, reason) => {
        if (reason === 'time') {
          activeCollectors.delete(message.author.id);
          const channel = message.channel;
          if (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof NewsChannel) {
            channel.send({
              content: `<@${message.author.id}> Command creation timed out.`,
              allowedMentions: { parse: [] }
            }).catch(() => {});
          }
        }
      });

      nameCollector.stop('completed');
    });

    nameCollector.on('end', (collected, reason) => {
      activeCollectors.delete(message.author.id);
      if (reason === 'time') {
        const channel = message.channel;
        if (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof NewsChannel) {
          channel.send({
            content: `<@${message.author.id}> Command creation timed out.`,
            allowedMentions: { parse: [] }
          }).catch(() => {});
        }
      }
    });
  }
};
