import { EmbedBuilder } from "discord.js";
import type { ServerConfig } from "../types/config";
import { buildBaseSetupEmbed, buildSetupHomeEmbed } from "../utils/setupUi";

export function buildMainEmbed(config: ServerConfig): EmbedBuilder {
  return buildSetupHomeEmbed(config);
}

export function buildPrefixEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseSetupEmbed(
    "Prefix Settings",
    `Current prefix: \`${config.prefix || "."}\`\n\nUse the button below to change the bot's prefix for this server.`,
  );
}

export function buildRoleEmbed(config: ServerConfig): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length
    ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(", ")
    : "None";
  return buildBaseSetupEmbed("Mod roles", `${modRolesDisplay}\n\nNote: Re-select roles (including previously selected) to ensure they are included.`);
}

export function buildPermissionsEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseSetupEmbed("Mod Commands", "Enable or disable all moderator commands for this server.").addFields(
    { name: "Status", value: (config.permissions?.moderatorCommandsEnabled ?? true) ? "Enabled" : "Disabled", inline: false },
    { name: "Note", value: "When disabled, the bot will completely ignore all mod commands (no response). This applies to everyone, including the server owner.", inline: false },
  );
}

export function buildLoggingEmbed(config: ServerConfig): EmbedBuilder {
  const logging = config.logging || ({} as any);
  const modChannelId = logging.moderationLogChannelId || logging.logChannelId;
  const msgChannelId = logging.messageLogChannelId;
  const memChannelId = logging.memberLogChannelId;

  const modChannelText = modChannelId ? `<#${modChannelId}>` : "Not set";
  const msgChannelText = msgChannelId ? `<#${msgChannelId}>` : (modChannelId ? `Inherits ${modChannelText}` : "Not set");
  const memChannelText = memChannelId ? `<#${memChannelId}>` : (modChannelId ? `Inherits ${modChannelText}` : "Not set");

  return buildBaseSetupEmbed(
    "Logging",
    "Set logging channels for moderation, message, and member events. Webhooks are created automatically when possible."
  ).addFields(
    { name: "Moderation", value: modChannelText, inline: true },
    { name: "Messages", value: msgChannelText, inline: true },
    { name: "Members", value: memChannelText, inline: true },
  ).setFooter({ text: "If a section channel is unset, it will inherit the main moderation log channel when possible." });
}

export function buildHoneypotEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseSetupEmbed(
    "Honeypot",
    "Users who post in the trap channel get banned. Mod roles are exempt."
  ).addFields(
    { name: "Enabled", value: config.features?.honeypot?.enabled ? "Yes" : "No", inline: true },
    { name: "Channel", value: config.features?.honeypot?.channelId ? `<#${config.features.honeypot.channelId}>` : "Not set", inline: true },
    { name: "Auto Unban", value: config.features?.honeypot?.autoUnban ? "Yes (10s)" : "No", inline: true },
  );
}

export function buildWhitelistEmbed(config: ServerConfig): EmbedBuilder {
  const enabled = Boolean(config.features?.whitelistEnforcement?.enabled);
  const whitelist = config.features?.whitelistEnforcement?.whitelistedUserIds || [];
  const countText = whitelist.length ? `${whitelist.length} users` : "None";

  return buildBaseSetupEmbed(
    "Whitelist Enforcement",
    "Require new joins to be explicitly whitelisted. Existing members are not removed. Use `.whitelist <userId>` to whitelist users. Enabling this means you agree to the bot's Terms of Service."
  ).addFields(
    { name: "Enabled", value: enabled ? "Yes" : "No", inline: true },
    { name: "Whitelisted IDs", value: countText, inline: true },
    {
      name: "Note",
      value: "This does not kick members who were already in the server. Only new joiners who are not whitelisted are DM'd and kicked.",
      inline: false,
    },
  );
}

function shorten(input: string, max = 900): string {
  const text = String(input ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export function buildWelcomeEmbed(config: ServerConfig): EmbedBuilder {
  const w = config.features?.welcome || { enabled: false };
  const e = w.embed || {};
  return buildBaseSetupEmbed("Welcome", "Public welcome embed (per-server).").addFields(
    { name: "Enabled", value: w.enabled ? "Yes" : "No", inline: true },
    { name: "Channel", value: w.channelId ? `<#${w.channelId}>` : "Not set", inline: true },
    { name: "Title", value: shorten(e.title || "Welcome!"), inline: false },
    { name: "Description", value: shorten(e.description || "{user} joined the server."), inline: false },
    { name: "Color", value: e.color ? `\`${e.color}\`` : "`#0099ff`", inline: true },
  );
}

export function buildGoodbyeEmbed(config: ServerConfig): EmbedBuilder {
  const g = config.features?.goodbye || { enabled: false };
  const e = g.embed || {};
  return buildBaseSetupEmbed("Goodbye", "Public leave embed (per-server).").addFields(
    { name: "Enabled", value: g.enabled ? "Yes" : "No", inline: true },
    { name: "Channel", value: g.channelId ? `<#${g.channelId}>` : "Not set", inline: true },
    { name: "Title", value: shorten(e.title || "Goodbye!"), inline: false },
    { name: "Description", value: shorten(e.description || "{user} left the server."), inline: false },
    { name: "Color", value: e.color ? `\`${e.color}\`` : "`#0099ff`", inline: true },
  );
}

export function buildRoleRestoreEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseSetupEmbed("Role Restore", "Stores a user’s roles on leave and restores them on rejoin.").addFields(
    { name: "Enabled", value: config.features?.roleRestore?.enabled ? "Yes" : "No", inline: true },
  );
}

export function buildAutoModerationEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseSetupEmbed(
    "Extras",
    "Enable or disable extra message protections and embed behavior."
  ).addFields(
    { name: "Auto Embed", value: config.features?.autoEmbed?.enabled ? "Enabled" : "Disabled", inline: true },
    { name: "Invite Block", value: config.features?.inviteBlock?.enabled ? "Enabled" : "Disabled", inline: true },
  ).setFooter({ text: "Auto Embed converts supported social media links into preview format. Invite Block removes Discord invite links." });
}

