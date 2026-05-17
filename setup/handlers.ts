import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  type ChannelSelectMenuInteraction,
  type ModalSubmitInteraction,
  type Interaction,
} from "discord.js";
import configManager from "../utils/ConfigManager";
import type { ServerConfig } from "../types/config";
import { setLogSectionChannel } from "../utils/logWebhooks";
import { safeReply, safeReplyOrFollowUp, safeUpdate } from "../utils/interactionHelpers";
import {
  buildAutoModerationEmbed,
  buildGoodbyeEmbed,
  buildHoneypotEmbed,
  buildLoggingEmbed,
  buildMainEmbed,
  buildPermissionsEmbed,
  buildPrefixEmbed,
  buildRoleEmbed,
  buildRoleRestoreEmbed,
  buildWelcomeEmbed,
} from "./embeds";
import {
  buildAutoModerationRows,
  buildGoodbyeRows,
  buildHoneypotRows,
  buildLoggingRows,
  buildMainRows,
  buildPermissionsRows,
  buildPrefixRows,
  buildRoleRestoreRows,
  buildRoleRows,
  buildWelcomeRows,
} from "./rows";
import { handleSetupMenu } from "./menu";

const SETUP_DENIED_MESSAGE = "You need administrator or server owner to use setup.";
const REFRESH_FAILURE_MESSAGE = "Saved, but I couldn't refresh the view. Reopen /setup if needed.";

async function saveConfigAndRefresh(
  interaction: Interaction,
  config: ServerConfig,
  embed: any,
  rows: any[],
  failureMessage = REFRESH_FAILURE_MESSAGE
): Promise<void> {
  await configManager.saveServerConfig(config);
  await safeUpdate(interaction, { embeds: [embed], components: rows }, failureMessage);
}

function hasSetupAccess(interaction: Interaction & { memberPermissions?: any; guild?: any }): boolean {
  const botOwnerId = process.env.BOT_OWNER_ID || process.env.OWNER_ID || "";
  const isOwner = (interaction as any).user?.id === botOwnerId;
  const isGuildOwner = interaction.guild?.ownerId === (interaction as any).user?.id;
  const isAdmin = (interaction as any).memberPermissions?.has?.(PermissionFlagsBits.Administrator);
  return Boolean(isOwner || isGuildOwner || isAdmin);
}

export async function handleSetupStringSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  if (interaction.customId !== "setup_menu") return false;
  if (!hasSetupAccess(interaction)) {
    await safeReply(interaction, SETUP_DENIED_MESSAGE);
    return true;
  }
  await handleSetupMenu(interaction);
  return true;
}

export async function handleSetupRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
  if (interaction.customId !== "setup_role_mods") return false;
  if (!hasSetupAccess(interaction)) {
    await safeReply(interaction, SETUP_DENIED_MESSAGE);
    return true;
  }
  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);
  config.permissions.moderatorRoles = interaction.values as string[];
  await saveConfigAndRefresh(interaction, config, buildRoleEmbed(config), buildRoleRows(true));
  return true;
}

export async function handleSetupChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
  const known = new Set([
    "setup_log_channel",
    "setup_message_log_channel",
    "setup_member_log_channel",
    "setup_honeypot_channel",
    "setup_welcome_channel",
    "setup_goodbye_channel",
  ]);
  if (!known.has(interaction.customId)) return false;
  if (!hasSetupAccess(interaction)) {
    await safeReply(interaction, SETUP_DENIED_MESSAGE);
    return true;
  }

  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);
  const channelId = interaction.values?.[0] || undefined;

  const loggingSectionMap = {
    setup_log_channel: "moderation",
    setup_message_log_channel: "messages",
    setup_member_log_channel: "members",
  } as const;

  if (loggingSectionMap[interaction.customId as keyof typeof loggingSectionMap]) {
    const section = loggingSectionMap[interaction.customId as keyof typeof loggingSectionMap];
    const res = await setLogSectionChannel(guild, config, section, channelId);
    await saveConfigAndRefresh(interaction, config, buildLoggingEmbed(config), buildLoggingRows(true));
    if (res.message) await safeReplyOrFollowUp(interaction, res.message);
    return true;
  }
  if (interaction.customId === "setup_honeypot_channel") {
    config.features = {
      ...(config.features || {}),
      honeypot: {
        ...(config.features?.honeypot || { enabled: true, deleteMessage: true, autoUnban: false }),
        enabled: Boolean(channelId),
        channelId,
        autoBan: Boolean(channelId),
      },
    };
    await saveConfigAndRefresh(interaction, config, buildHoneypotEmbed(config), buildHoneypotRows(true));
    return true;
  }
  if (interaction.customId === "setup_welcome_channel") {
    config.features.welcome = { ...(config.features.welcome || {}), channelId };
    await saveConfigAndRefresh(interaction, config, buildWelcomeEmbed(config), buildWelcomeRows(true));
    return true;
  }
  if (interaction.customId === "setup_goodbye_channel") {
    config.features.goodbye = { ...(config.features.goodbye || {}), channelId };
    await saveConfigAndRefresh(interaction, config, buildGoodbyeEmbed(config), buildGoodbyeRows(true));
    return true;
  }
  return false;
}

export async function handleSetupButton(interaction: ButtonInteraction): Promise<boolean> {
  const customId = interaction.customId;
  const knownPrefixes = ["toggle_", "change_prefix", "reset_prefix", "reset_welcome_embed", "reset_goodbye_embed", "edit_welcome_embed", "edit_goodbye_embed", "setup_back"];
  if (!knownPrefixes.some((p) => customId.startsWith(p))) return false;
  if (!hasSetupAccess(interaction)) {
    await safeReply(interaction, SETUP_DENIED_MESSAGE);
    return true;
  }

  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);

  if (customId === "setup_back") {
    await safeUpdate(interaction, { embeds: [buildMainEmbed(config)], components: buildMainRows() }, REFRESH_FAILURE_MESSAGE);
    return true;
  }

  if (customId === "toggle_welcome") {
    config.features.welcome = { ...(config.features.welcome || {}), enabled: !config.features?.welcome?.enabled };
    await saveConfigAndRefresh(interaction, config, buildWelcomeEmbed(config), buildWelcomeRows(true));
    return true;
  }
  if (customId === "toggle_goodbye") {
    config.features.goodbye = { ...(config.features.goodbye || {}), enabled: !config.features?.goodbye?.enabled };
    await saveConfigAndRefresh(interaction, config, buildGoodbyeEmbed(config), buildGoodbyeRows(true));
    return true;
  }
  if (customId === "toggle_restore") {
    config.features.roleRestore = { ...(config.features.roleRestore || {}), enabled: !config.features?.roleRestore?.enabled };
    await saveConfigAndRefresh(interaction, config, buildRoleRestoreEmbed(config), buildRoleRestoreRows(true));
    return true;
  }
  if (customId === "toggle_auto_embed") {
    config.features.autoEmbed = { ...(config.features.autoEmbed || {}), enabled: !config.features?.autoEmbed?.enabled };
    await saveConfigAndRefresh(interaction, config, buildAutoModerationEmbed(config), buildAutoModerationRows(true));
    return true;
  }
  if (customId === "toggle_invite_block") {
    config.features.inviteBlock = { ...(config.features.inviteBlock || {}), enabled: !config.features?.inviteBlock?.enabled };
    await saveConfigAndRefresh(interaction, config, buildAutoModerationEmbed(config), buildAutoModerationRows(true));
    return true;
  }
  if (customId === "toggle_moderator_commands") {
    config.permissions.moderatorCommandsEnabled = !(config.permissions.moderatorCommandsEnabled ?? true);
    await saveConfigAndRefresh(interaction, config, buildPermissionsEmbed(config), buildPermissionsRows(true));
    return true;
  }
  if (customId === "toggle_honeypot") {
    config.features.honeypot = {
      ...(config.features.honeypot || { deleteMessage: true, autoBan: true, autoUnban: false }),
      enabled: !config.features?.honeypot?.enabled,
    };
    await saveConfigAndRefresh(interaction, config, buildHoneypotEmbed(config), buildHoneypotRows(true));
    return true;
  }
  if (customId === "toggle_honeypot_autounban") {
    config.features.honeypot = { ...(config.features.honeypot || {}), autoUnban: !config.features?.honeypot?.autoUnban };
    await saveConfigAndRefresh(interaction, config, buildHoneypotEmbed(config), buildHoneypotRows(true));
    return true;
  }

  if (customId === "change_prefix") {
    const modal = new ModalBuilder().setCustomId("prefix_modal").setTitle("Change Bot Prefix");
    const prefixInput = new TextInputBuilder()
      .setCustomId("prefix_input")
      .setLabel("New Prefix (1-5 characters)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter new prefix...")
      .setValue(config.prefix)
      .setRequired(true)
      .setMaxLength(5)
      .setMinLength(1);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(prefixInput));

    await interaction.showModal(modal).catch(async () => {
      await safeReplyOrFollowUp(interaction, { content: "I couldn't open the prefix modal. Please try again." });
    });
    return true;
  }

  if (customId === "reset_prefix") {
    config.prefix = ".";
    await saveConfigAndRefresh(interaction, config, buildPrefixEmbed(config), buildPrefixRows(true));
    return true;
  }

  if (customId === "reset_welcome_embed") {
    config.features.welcome = { ...(config.features.welcome || {}), embed: undefined };
    await saveConfigAndRefresh(interaction, config, buildWelcomeEmbed(config), buildWelcomeRows(true));
    return true;
  }

  if (customId === "reset_goodbye_embed") {
    config.features.goodbye = { ...(config.features.goodbye || {}), embed: undefined };
    await saveConfigAndRefresh(interaction, config, buildGoodbyeEmbed(config), buildGoodbyeRows(true));
    return true;
  }

  if (customId === "edit_welcome_embed") {
    const modal = new ModalBuilder().setCustomId("welcome_embed_modal").setTitle("Edit Welcome Embed");
    const current = config.features?.welcome?.embed || {};
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("title").setLabel("Title (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setValue(current.title ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Description (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(2000).setValue(current.description ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("color").setLabel("Color hex (optional, e.g. #0099ff)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7).setValue(current.color ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("footer").setLabel("Footer (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2048).setValue(current.footer ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("imageUrl").setLabel("Image URL (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4000).setValue(current.imageUrl ?? "")),
    );
    await interaction.showModal(modal).catch(async () => {
      await safeReply(interaction, "Unable to open the welcome embed modal. Try again.");
    });
    return true;
  }

  if (customId === "edit_goodbye_embed") {
    const modal = new ModalBuilder().setCustomId("goodbye_embed_modal").setTitle("Edit Goodbye Embed");
    const current = config.features?.goodbye?.embed || {};
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("title").setLabel("Title (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setValue(current.title ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Description (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(2000).setValue(current.description ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("color").setLabel("Color hex (optional, e.g. #0099ff)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7).setValue(current.color ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("footer").setLabel("Footer (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2048).setValue(current.footer ?? "")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("imageUrl").setLabel("Image URL (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4000).setValue(current.imageUrl ?? "")),
    );
    await interaction.showModal(modal).catch(async () => {
      await safeReply(interaction, "Unable to open the goodbye embed modal. Try again.");
    });
    return true;
  }

  return false;
}

export async function handleSetupModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  const known = new Set(["prefix_modal", "welcome_embed_modal", "goodbye_embed_modal"]);
  if (!known.has(interaction.customId)) return false;
  if (!hasSetupAccess(interaction)) {
    await safeReply(interaction, SETUP_DENIED_MESSAGE);
    return true;
  }

  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);

  if (interaction.customId === "prefix_modal") {
    const newPrefix = interaction.fields.getTextInputValue("prefix_input");
    if (newPrefix && newPrefix.length >= 1 && newPrefix.length <= 5) {
      config.prefix = newPrefix;
      await configManager.saveServerConfig(config);
      await safeReplyOrFollowUp(interaction, {
        content: `Prefix changed to \`${newPrefix}\``,
        embeds: [buildPrefixEmbed(config)],
        components: buildPrefixRows(true),
      });
    } else {
      await safeReplyOrFollowUp(interaction, { content: "Invalid prefix. Please use 1-5 characters." });
    }
    return true;
  }

  if (interaction.customId === "welcome_embed_modal") {
    const title = interaction.fields.getTextInputValue("title").trim();
    const description = interaction.fields.getTextInputValue("description").trim();
    const color = interaction.fields.getTextInputValue("color").trim();
    const footer = interaction.fields.getTextInputValue("footer").trim();
    const imageUrl = interaction.fields.getTextInputValue("imageUrl").trim();

    const embed = {
      ...(config.features.welcome.embed || {}),
      title: title || undefined,
      description: description || undefined,
      color: color || undefined,
      footer: footer || undefined,
      imageUrl: imageUrl || undefined,
      thumbnail: config.features.welcome.embed?.thumbnail ?? true,
    };
    config.features.welcome = { ...(config.features.welcome || {}), embed };
    await configManager.saveServerConfig(config);
    await safeReplyOrFollowUp(interaction, "Welcome embed updated.");
    return true;
  }

  if (interaction.customId === "goodbye_embed_modal") {
    const title = interaction.fields.getTextInputValue("title").trim();
    const description = interaction.fields.getTextInputValue("description").trim();
    const color = interaction.fields.getTextInputValue("color").trim();
    const footer = interaction.fields.getTextInputValue("footer").trim();
    const imageUrl = interaction.fields.getTextInputValue("imageUrl").trim();

    const embed = {
      ...(config.features.goodbye.embed || {}),
      title: title || undefined,
      description: description || undefined,
      color: color || undefined,
      footer: footer || undefined,
      imageUrl: imageUrl || undefined,
      thumbnail: config.features.goodbye.embed?.thumbnail ?? true,
    };
    config.features.goodbye = { ...(config.features.goodbye || {}), embed };
    await configManager.saveServerConfig(config);
    await safeReplyOrFollowUp(interaction, "Goodbye embed updated.");
    return true;
  }

  return false;
}

