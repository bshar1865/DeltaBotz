import { Message, PermissionsBitField } from "discord.js";
import { ExtendedClient } from "../client";
import { getGuildDB } from "../utils/db";
import configManager from "../utils/ConfigManager";
import { logError } from "../utils/errorLogger";
import { getEmbeddableUrl } from "../prefix-commands/General/embed";
import { deleteUserMessagesLastDay } from "../utils/messageDeletion";
import idclass from "../utils/idclass";

const defaultPrefix = ".";

// Utility to split a string into 1024-character chunks
function splitMessage(str: string, maxLength = 1024): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < str.length) {
    chunks.push(str.slice(start, start + maxLength));
    start += maxLength;
  }
  return chunks;
}

async function handleHoneypot(message: Message, config: any) {
  if (!message.inGuild() || message.author.bot || message.system) return;

  const guildId = message.guildId!;
  const gdb = getGuildDB(guildId);

  const honeypotChannelId =
    config.features.honeypot.channelId ||
    (await gdb.get<string>(`honeypot_${guildId}`)) || '';
  const logChannelId =
    config.logging.logChannelId ||
    (await gdb.get<string>(`log_${guildId}`)) || '';
  const deleteMessage =
    config.features.honeypot.deleteMessage ??
    (await gdb.get<boolean>(`deleteMessage_${guildId}`)) ??
    true;

  if (honeypotChannelId && message.channel.id === honeypotChannelId && config.features.honeypot.enabled) {
    const member = message.member;
    if (member) {
      const allModRoles = config.permissions.moderatorRoles;
      if (member.roles.cache.some((r) => allModRoles.includes(r.id))) return;

      const me = message.guild!.members.me!;
      const snapshot = message.content ?? "";

      if (
        deleteMessage &&
        me.permissionsIn(message.channel).has(PermissionsBitField.Flags.ManageMessages)
      ) {
        await message.delete().catch(() => null);
      }

      if (
        config.features.honeypot.autoBan &&
        me.permissions.has(PermissionsBitField.Flags.BanMembers) &&
        me.roles.highest.comparePositionTo(member.roles.highest) > 0
      ) {
        try {
          const deletedCount = await deleteUserMessagesLastDay(message.guild!, message.author.id);
          if (deletedCount > 0) {
            console.log(`Deleted ${deletedCount} messages from user ${message.author.id} before honeypot ban`);
          }
        } catch (error) {
          console.error('Error deleting user messages before honeypot ban:', error);
        }

        const banSuccess = await message.guild!.members
          .ban(message.author.id, {
            reason: `Posted in honeypot channel (${message.channel.id})`,
          })
          .then(() => true)
          .catch(() => false);

        if (banSuccess && config.features.honeypot.autoUnban) {
          setTimeout(async () => {
            try {
              await message.guild!.members.unban(message.author.id, 'Auto-unban after honeypot ban');
            } catch {}
          }, 10 * 1000);
        }
      }

      if (logChannelId && config.logging.enabled) {
        const logChannel = await message.guild!.channels.fetch(logChannelId).catch(() => null);
        if (logChannel?.isTextBased()) {
          const messageChunks = splitMessage(snapshot || "--");
          const embedFields: any[] = [{ name: "User ID", value: message.author.id }];
          messageChunks.forEach((chunk, i) => {
            embedFields.push({
              name: i === 0 ? "Message" : `Message (part ${i})`,
              value: chunk
            });
          });

          await logChannel.send({
            embeds: [
              {
                title: "Honeypot Triggered.",
                description: `User **${message.author.tag}** posted in honeypot <#${honeypotChannelId}>`,
                fields: embedFields,
                timestamp: new Date().toISOString(),
              },
            ],
          });
        }
      }
    }
  }
}

async function handleInviteBlock(message: Message, config: any): Promise<boolean> {
  if (!message.inGuild() || message.author.bot || message.system || !config.features.inviteBlock?.enabled) {
    return false;
  }

  const member = message.member;
  if (!member) return false;

  const allModRoles = config.permissions.moderatorRoles;
  const isMod = message.author.id === config.permissions.ownerId ||
               member.roles.cache.some((r) => allModRoles.includes(r.id));

  if (isMod) return false;

  const invitePattern = /(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9]+/gi;
  if (!invitePattern.test(message.content)) return false;

  const me = message.guild!.members.me!;
  if (me.permissionsIn(message.channel).has(PermissionsBitField.Flags.ManageMessages)) {
    await message.delete().catch(() => null);
  }

  const logChannelId = config.logging.logChannelId;
  if (logChannelId && config.logging.enabled) {
    const logChannel = await message.guild!.channels.fetch(logChannelId).catch(() => null);
    if (logChannel?.isTextBased()) {
      await logChannel.send({
        content: `Action: Invite Block\nUser: ${message.author.tag} (${message.author.id})\nChannel: <#${message.channel.id}>\nMessage: ${message.content.substring(0, 500)}`,
        allowedMentions: { parse: [] }
      }).catch(() => null);
    }
  }

  return true;
}

async function handleAutoEmbed(message: Message, config: any, serverPrefix: string): Promise<boolean> {
  if (!message.inGuild() || message.author.bot || message.system) return false;
  if (message.content.startsWith(serverPrefix)) return false;
  if (!config.features.autoEmbed?.enabled) return false;

  const instagramUrlPattern = /https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/gi;
  const instagramUrls = message.content.match(instagramUrlPattern);

  if (instagramUrls && instagramUrls.length > 0) {
    for (const url of instagramUrls) {
      try {
        const embeddableUrl = await getEmbeddableUrl(url);

        if (embeddableUrl) {
          await message.reply({
            content: `here is embed:\n${embeddableUrl}`,
            allowedMentions: { parse: [] }
          });
        } else {
          await message.reply({
            content: "I cannot embed this :(",
            allowedMentions: { parse: [] }
          });
        }
      } catch {
        // Silently fail
      }
    }
    return true;
  }

  return false;
}

async function handleSetPrefix(message: Message, config: any): Promise<boolean> {
  if (!message.inGuild()) return false;
  if (!message.content.toLowerCase().startsWith('setprefix')) return false;
  if (!message.member?.permissions.has('Administrator')) return false;

  const newPrefix = message.content.split(' ')[1];
  if (newPrefix && newPrefix.length <= 5 && newPrefix.length >= 1) {
    config.prefix = newPrefix;
    await configManager.saveServerConfig(config);
    await message.reply({
      content: `Prefix changed to \`${newPrefix}\``,
      allowedMentions: { parse: [] }
    });
  } else {
    await message.reply({
      content: 'Invalid prefix. Please use 1-5 characters.',
      allowedMentions: { parse: [] }
    });
  }

  return true;
}

async function handlePrefixCommand(message: Message, client: ExtendedClient, config: any, serverPrefix: string) {
  if (!message.content.startsWith(serverPrefix)) return;

  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const commandName = args.shift()!.toLowerCase();

  const gdb = getGuildDB(message.guild!.id);
  const tempCommands = await gdb.get<Array<{ name: string; response: string }>>('tempCommands') || [];
  const tempCommand = tempCommands.find(c => c.name.toLowerCase() === commandName);

  if (tempCommand) {
    const channel = message.channel;
    if ('send' in channel) {
      await channel.send({
        content: tempCommand.response,
        allowedMentions: { parse: [] }
      });
    }
    return;
  }

  const command = client.prefixCommands.get(commandName);

  if (command) {
    if (command.isModeratorCommand) {
      const moderatorCommandsEnabled = config.permissions.moderatorCommandsEnabled ?? true;
      if (!moderatorCommandsEnabled) {
        return;
      }
    }

    if (command.isModeratorCommand) {
      const allModRoles = config.permissions.moderatorRoles;
      if (
        message.author.id !== config.permissions.ownerId &&
        message.author.id !== idclass.ownershipID() &&
        !message.member?.roles.cache.some((r) => allModRoles.includes(r.id))
      ) {
        return message.reply({
          content: "You don't have permission to use this command.",
          allowedMentions: { parse: [] },
        });
      }
    }

    try {
      await command.execute(message, args, client);
    } catch (error) {
      console.error(`Error in prefix command ${commandName}:`, error);
      try {
        await logError(
          error instanceof Error ? error : String(error),
          `prefix:${commandName}`,
          { channelId: message.channel.id, guildId: message.guild?.id },
          client as any,
          message.guild ?? undefined
        );
      } catch {}
      message.reply({
        content: process.env.ERR,
        allowedMentions: { parse: [] },
      });
    }
  }
}

export default {
  name: "messageCreate",
  once: false,
  async execute(message: Message, client: ExtendedClient) {
    if (message.inGuild()) {
      const config = await configManager.getOrCreateConfig(message.guild);
      await handleHoneypot(message, config);
      const serverPrefix = config.prefix || defaultPrefix;

      if (await handleInviteBlock(message, config)) return;
      if (await handleAutoEmbed(message, config, serverPrefix)) return;
      if (await handleSetPrefix(message, config)) return;

      await handlePrefixCommand(message, client, config, serverPrefix);
    }
  },
};

