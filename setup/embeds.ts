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
  const hooks = (logging.webhooks || {}) as any;

  const modChannelId = logging.moderationLogChannelId || logging.logChannelId;
  const msgChannelId = logging.messageLogChannelId;
  const memChannelId = logging.memberLogChannelId;

  const modChannelText = modChannelId ? `<#${modChannelId}>` : "Not set";
  const msgChannelText = msgChannelId ? `<#${msgChannelId}>` : (modChannelId ? `Inherits ${modChannelText}` : "Not set");
  const memChannelText = memChannelId ? `<#${memChannelId}>` : (modChannelId ? `Inherits ${modChannelText}` : "Not set");

  const modHookOk = Boolean(hooks.moderation?.id && hooks.moderation?.token && hooks.moderation?.channelId);
  const msgHookOk = Boolean(hooks.messages?.id && hooks.messages?.token && hooks.messages?.channelId);
  const memHookOk = Boolean(hooks.members?.id && hooks.members?.token && hooks.members?.channelId);

  return buildBaseSetupEmbed("Logging", "Pick channels per section. The bot will auto-create a webhook in each selected channel.").addFields(
    { name: "Enabled", value: logging.enabled ? "Yes" : "No", inline: true },
    { name: "Moderation", value: `${modChannelText}\nWebhook: ${modHookOk ? "Yes" : "No"}`, inline: true },
    { name: "Messages", value: `${msgChannelText}\nWebhook: ${msgHookOk ? "Yes" : "No"}`, inline: true },
    { name: "Members", value: `${memChannelText}\nWebhook: ${memHookOk ? "Yes" : "No"}`, inline: true },
  );
}

export function buildHoneypotEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseSetupEmbed("Honeypot").addFields(
    { name: "Enabled", value: config.features?.honeypot?.enabled ? "Yes" : "No", inline: true },
    { name: "Channel", value: config.features?.honeypot?.channelId ? `<#${config.features.honeypot.channelId}>` : "Not set", inline: true },
    { name: "Auto Unban", value: config.features?.honeypot?.autoUnban ? "Yes" : "No", inline: true },
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
  return new EmbedBuilder()
    .setTitle("Others")
    .setColor("#0099ff")
    .addFields(
      { name: "Auto Embed", value: config.features?.autoEmbed?.enabled ? "Enabled" : "Disabled", inline: true },
      { name: "Invite Block", value: config.features?.inviteBlock?.enabled ? "Enabled" : "Disabled", inline: true },
    )
    .setFooter({ text: "Auto Embed converts supported social links to embeddable format. Invite Block deletes Discord invites (mods are exempt)." })
    .setTimestamp();
}

