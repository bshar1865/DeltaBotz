import { Message, PermissionsBitField } from "discord.js";
import { ExtendedClient } from "../utils/ExtendedClient";
import db, { getGuildDB } from "../utils/db";
import configManager from "../utils/ConfigManager";
import { logError } from "../utils/errorLogger";

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

export default {
  name: "messageCreate",
  once: false,
  async execute(message: Message, client: ExtendedClient) {
    // --- Honeypot logic ---
    if (message.inGuild() && !message.author.bot && !message.system) {
      const guildId = message.guildId!;
      const config = await configManager.getOrCreateConfig(message.guild!);
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

          // Delete message
          if (
            deleteMessage &&
            me.permissionsIn(message.channel).has(PermissionsBitField.Flags.ManageMessages)
          ) {
            await message.delete().catch(() => null);
          }

          // Ban user
          if (
            config.features.honeypot.autoBan &&
            me.permissions.has(PermissionsBitField.Flags.BanMembers) &&
            me.roles.highest.comparePositionTo(member.roles.highest) > 0
          ) {
            const banSuccess = await message.guild!.members
              .ban(message.author.id, {
                reason: `Posted in honeypot channel (${message.channel.id})`,
                deleteMessageDays: config.moderation.punishment.deleteMessageDays,
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

          // Log to log channel
          if (logChannelId && config.logging.enabled) {
            const logChannel = await message.guild!.channels.fetch(logChannelId).catch(() => null);
            if (logChannel?.isTextBased()) {
              const messageChunks = splitMessage(snapshot || "—");
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

    // --- Prefix command logic ---
    if (message.inGuild()) {
      const config = await configManager.getOrCreateConfig(message.guild);
      if (message.content.toLowerCase().startsWith('setprefix') && message.member?.permissions.has('Administrator')) {
        const newPrefix = message.content.split(' ')[1];
        if (newPrefix && newPrefix.length <= 5 && newPrefix.length >= 1) {
          config.prefix = newPrefix;
          await configManager.saveServerConfig(config);
          await message.reply({
            content: `Prefix changed to \`${newPrefix}\``,
            allowedMentions: { parse: [] }
          });
          return;
        } else {
          await message.reply({
            content: 'Invalid prefix. Please use 1-5 characters.',
            allowedMentions: { parse: [] }
          });
          return;
        }
      }
      const serverPrefix = config.prefix || defaultPrefix;
      if (!message.content.startsWith(serverPrefix)) return;

      const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
      const commandName = args.shift()!.toLowerCase();
      const command = client.prefixCommands.get(commandName);

      if (command) {
        const allModRoles = config.permissions.moderatorRoles;
        if (
          message.author.id !== config.permissions.ownerId &&
          !message.member?.roles.cache.some((r) => allModRoles.includes(r.id))
        ) {
          return message.reply({
            content: "You don't have permission to use this command.",
            allowedMentions: { parse: [] },
          });
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
  },
};
