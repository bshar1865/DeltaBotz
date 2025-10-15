import { Message, PermissionsBitField } from "discord.js";
import { ExtendedClient } from "../utils/ExtendedClient";
import db, { getGuildDB } from "../utils/db";
import configManager from "../utils/ConfigManager";

const prefixes = ["?", "."];

export default {
  name: "messageCreate",
  once: false,
  async execute(message: Message, client: ExtendedClient) {
    // --- Honeypot logic ---
    if (message.inGuild() && !message.author.bot && !message.system) {
      const guildId = message.guildId!;

      // Get server configuration
      const config = await configManager.getOrCreateConfig(message.guild!);

      // Use config values with fallback to database and idclass defaults
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
          // Check if user has permission to bypass honeypot
          const allModRoles = config.permissions.moderatorRoles;
          
          if (member.roles.cache.some((r) => allModRoles.includes(r.id))) {
            return;
          }

          const me = message.guild!.members.me!;
          const snapshot = message.content ?? "";

          // 1) Delete message if enabled
          if (
            deleteMessage &&
            me.permissionsIn(message.channel).has(PermissionsBitField.Flags.ManageMessages)
          ) {
            await message.delete().catch(() => null);
          }

          // 2) Ban user if possible and enabled
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

            // 2b) Auto-unban after delay if enabled
            if (banSuccess && config.features.honeypot.autoUnban) {
              const seconds = 10;
              setTimeout(async () => {
                try {
                  await message.guild!.members.unban(message.author.id, 'Auto-unban after honeypot ban');
                } catch {}
              }, seconds * 1000);
            }
          }

          // 3) Log to log channel if logging is enabled
          if (logChannelId && config.logging.enabled) {
            const logChannel = await message.guild!.channels.fetch(logChannelId).catch(() => null);
            if (logChannel?.isTextBased()) {
              await logChannel.send({
                embeds: [
                  {
                    title: "🚨 Honeypot Triggered",
                    description: `User **${message.author.tag}** posted in honeypot <#${honeypotChannelId}>`,
                    fields: [
                      { name: "User ID", value: message.author.id },
                      { name: "Message", value: snapshot || "—" },
                    ],
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
      const serverPrefixes = [config.prefix, ...prefixes];
      const prefix = serverPrefixes.find((p) => message.content.startsWith(p));
      if (!prefix) return;

      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()!.toLowerCase();
      const command = client.prefixCommands.get(commandName);

      if (command) {
        // Check permissions using config
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
          message.reply({
            content: process.env.ERR,
            allowedMentions: { parse: [] },
          });
        }
      }
    }
  },
};
