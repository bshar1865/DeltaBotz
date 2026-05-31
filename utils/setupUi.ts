import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ServerConfig } from "../types/config";

export function buildSetupMenuRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("setup_menu")
    .setPlaceholder("Pick a setup section")
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Prefix").setValue("prefix").setDescription("Set custom bot prefix"),
      new StringSelectMenuOptionBuilder().setLabel("Mod roles").setValue("roles").setDescription("View moderator roles"),
      new StringSelectMenuOptionBuilder().setLabel("Mod Commands").setValue("permissions").setDescription("Enable/disable moderator commands"),
      new StringSelectMenuOptionBuilder().setLabel("Logging").setValue("logging").setDescription("View logging settings"),
      new StringSelectMenuOptionBuilder().setLabel("Honeypot").setValue("honeypot").setDescription("View honeypot settings"),
      new StringSelectMenuOptionBuilder().setLabel("Whitelist Enforcement").setValue("whitelist_enforcement").setDescription("Require new joins to be whitelisted"),
      new StringSelectMenuOptionBuilder().setLabel("Welcome").setValue("welcome").setDescription("Welcome embed settings"),
      new StringSelectMenuOptionBuilder().setLabel("Goodbye").setValue("goodbye").setDescription("Leave embed settings"),
      new StringSelectMenuOptionBuilder().setLabel("Role Restore").setValue("role_restore").setDescription("Store roles on leave and restore on join"),
      new StringSelectMenuOptionBuilder().setLabel("Others").setValue("auto_moderation").setDescription("Auto Embed and Invite Block"),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function buildBaseSetupEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor("#0099ff")
    .setTimestamp()
  if (description) embed.setDescription(description);
  return embed;
}

export function buildSetupHomeEmbed(config: ServerConfig): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length
    ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(", ")
    : "None";

  const loggingStatus = config.logging?.logChannelId || config.logging?.moderationLogChannelId
    ? "Configured"
    : "Not set";

  const activeFeatures = [
    config.features?.autoEmbed?.enabled ? "Auto Embed" : null,
    config.features?.inviteBlock?.enabled ? "Invite Block" : null,
    config.features?.honeypot?.enabled ? "Honeypot" : null,
    config.features?.whitelistEnforcement?.enabled ? "Whitelist Enforcement" : null,
    config.features?.welcome?.enabled ? "Welcome" : null,
    config.features?.goodbye?.enabled ? "Goodbye" : null,
    config.features?.roleRestore?.enabled ? "Role Restore" : null,
  ]
    .filter(Boolean)
    .join(" • ") || "None";

  return buildBaseSetupEmbed(
    "Setup",
    "Choose a section below to update your server settings. Most changes save instantly."
  )
    .addFields(
      { name: "Prefix", value: `\`${config.prefix || "."}\``, inline: true },
      { name: "Who can use Mod Commands?", value: modRolesDisplay, inline: false },
      { name: "Logging", value: loggingStatus, inline: true },
      { name: "Active features", value: activeFeatures, inline: false },
    )
    .setFooter({ text: "Pick a setup section from the menu below." });
}

