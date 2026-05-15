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
} from "discord.js";
import configManager from "../utils/ConfigManager";
import idclass from "../utils/idclass";
import { setLogSectionChannel } from "../utils/logWebhooks";
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

function hasSetupAccess(interaction: { user?: any; memberPermissions?: any }): boolean {
  const isOwner = (interaction as any).user?.id === idclass.ownershipID();
  const isAdmin = (interaction as any).memberPermissions?.has?.(PermissionFlagsBits.Administrator);
  return Boolean(isOwner || isAdmin);
}

export async function handleSetupStringSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  if (interaction.customId !== "setup_menu") return false;
  if (!hasSetupAccess(interaction)) {
    await interaction.reply({ content: "You need Administrator to use setup.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  await handleSetupMenu(interaction);
  return true;
}

export async function handleSetupRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
  if (interaction.customId !== "setup_role_mods") return false;
  if (!hasSetupAccess(interaction)) {
    await interaction.reply({ content: "You need Administrator to use setup.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);
  config.permissions.moderatorRoles = interaction.values as string[];
  await configManager.saveServerConfig(config);
  const embed = buildRoleEmbed(config);
  await interaction.update({ embeds: [embed], components: buildRoleRows(true) }).catch(async (error: any) => {
    if (error?.code === 10062) return;
    await interaction.followUp({ content: "Roles updated but failed to refresh display.", flags: MessageFlags.Ephemeral }).catch(() => {});
  });
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
    await interaction.reply({ content: "You need Administrator to use setup.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);
  const channelId = interaction.values?.[0] || undefined;

  if (interaction.customId === "setup_log_channel") {
    const res = await setLogSectionChannel(guild, config, "moderation", channelId);
    await interaction.update({ embeds: [buildLoggingEmbed(config)], components: buildLoggingRows(true) }).catch(() => {});
    if (res.message) await interaction.followUp({ content: res.message, flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (interaction.customId === "setup_message_log_channel") {
    const res = await setLogSectionChannel(guild, config, "messages", channelId);
    await interaction.update({ embeds: [buildLoggingEmbed(config)], components: buildLoggingRows(true) }).catch(() => {});
    if (res.message) await interaction.followUp({ content: res.message, flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (interaction.customId === "setup_member_log_channel") {
    const res = await setLogSectionChannel(guild, config, "members", channelId);
    await interaction.update({ embeds: [buildLoggingEmbed(config)], components: buildLoggingRows(true) }).catch(() => {});
    if (res.message) await interaction.followUp({ content: res.message, flags: MessageFlags.Ephemeral }).catch(() => {});
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
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildHoneypotEmbed(config)], components: buildHoneypotRows(true) }).catch(() => {});
    return true;
  }
  if (interaction.customId === "setup_welcome_channel") {
    config.features.welcome = { ...(config.features.welcome || {}), channelId };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildWelcomeEmbed(config)], components: buildWelcomeRows(true) }).catch(() => {});
    return true;
  }
  if (interaction.customId === "setup_goodbye_channel") {
    config.features.goodbye = { ...(config.features.goodbye || {}), channelId };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildGoodbyeEmbed(config)], components: buildGoodbyeRows(true) }).catch(() => {});
    return true;
  }
  return false;
}

export async function handleSetupButton(interaction: ButtonInteraction): Promise<boolean> {
  const customId = interaction.customId;
  const knownPrefixes = ["toggle_", "change_prefix", "reset_prefix", "reset_welcome_embed", "reset_goodbye_embed", "edit_welcome_embed", "edit_goodbye_embed", "setup_back"];
  if (!knownPrefixes.some((p) => customId.startsWith(p))) return false;
  if (!hasSetupAccess(interaction)) {
    await interaction.reply({ content: "You need Administrator to use setup.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);

  if (customId === "setup_back") {
    await interaction.update({ embeds: [buildMainEmbed(config)], components: buildMainRows() }).catch(() => {});
    return true;
  }

  if (customId === "toggle_welcome") {
    config.features.welcome = { ...(config.features.welcome || {}), enabled: !config.features?.welcome?.enabled };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildWelcomeEmbed(config)], components: buildWelcomeRows(true) }).catch(() => {});
    return true;
  }
  if (customId === "toggle_goodbye") {
    config.features.goodbye = { ...(config.features.goodbye || {}), enabled: !config.features?.goodbye?.enabled };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildGoodbyeEmbed(config)], components: buildGoodbyeRows(true) }).catch(() => {});
    return true;
  }
  if (customId === "toggle_restore") {
    config.features.roleRestore = { ...(config.features.roleRestore || {}), enabled: !config.features?.roleRestore?.enabled };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildRoleRestoreEmbed(config)], components: buildRoleRestoreRows(true) }).catch(() => {});
    return true;
  }
  if (customId === "toggle_auto_embed") {
    config.features.autoEmbed = { ...(config.features.autoEmbed || {}), enabled: !config.features?.autoEmbed?.enabled };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildAutoModerationEmbed(config)], components: buildAutoModerationRows(true) }).catch(() => {});
    return true;
  }
  if (customId === "toggle_invite_block") {
    config.features.inviteBlock = { ...(config.features.inviteBlock || {}), enabled: !config.features?.inviteBlock?.enabled };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildAutoModerationEmbed(config)], components: buildAutoModerationRows(true) }).catch(() => {});
    return true;
  }
  if (customId === "toggle_moderator_commands") {
    config.permissions.moderatorCommandsEnabled = !(config.permissions.moderatorCommandsEnabled ?? true);
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildPermissionsEmbed(config)], components: buildPermissionsRows(true) }).catch(() => {});
    return true;
  }
  if (customId === "toggle_honeypot_autounban") {
    config.features.honeypot = { ...(config.features.honeypot || {}), autoUnban: !config.features?.honeypot?.autoUnban };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildHoneypotEmbed(config)], components: buildHoneypotRows(true) }).catch(() => {});
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
      await interaction.followUp({
        content: "I couldn't open the prefix modal. Please try again (Discord client issue).",
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    });
    return true;
  }

  if (customId === "reset_prefix") {
    config.prefix = ".";
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildPrefixEmbed(config)], components: buildPrefixRows(true) }).catch(async (error: any) => {
      if (error?.code === 10062) return;
      await interaction.followUp({ content: "Prefix reset but failed to update display. Please refresh.", flags: MessageFlags.Ephemeral }).catch(() => {});
    });
    return true;
  }

  if (customId === "reset_welcome_embed") {
    config.features.welcome = { ...(config.features.welcome || {}), embed: undefined };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildWelcomeEmbed(config)], components: buildWelcomeRows(true) }).catch(() => {});
    return true;
  }

  if (customId === "reset_goodbye_embed") {
    config.features.goodbye = { ...(config.features.goodbye || {}), embed: undefined };
    await configManager.saveServerConfig(config);
    await interaction.update({ embeds: [buildGoodbyeEmbed(config)], components: buildGoodbyeRows(true) }).catch(() => {});
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
    await interaction.showModal(modal).catch(() => {});
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
    await interaction.showModal(modal).catch(() => {});
    return true;
  }

  return false;
}

export async function handleSetupModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  const known = new Set(["prefix_modal", "welcome_embed_modal", "goodbye_embed_modal"]);
  if (!known.has(interaction.customId)) return false;
  if (!hasSetupAccess(interaction)) {
    await interaction.reply({ content: "You need Administrator to use setup.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const guild = interaction.guild!;
  const config = await configManager.getOrCreateConfig(guild);

  if (interaction.customId === "prefix_modal") {
    const newPrefix = interaction.fields.getTextInputValue("prefix_input");
    if (newPrefix && newPrefix.length >= 1 && newPrefix.length <= 5) {
      config.prefix = newPrefix;
      await configManager.saveServerConfig(config);
      await interaction.reply({
        content: `Prefix changed to \`${newPrefix}\``,
        embeds: [buildPrefixEmbed(config)],
        components: buildPrefixRows(true),
        flags: MessageFlags.Ephemeral,
      }).catch(async () => {
        await interaction.followUp({ content: `Prefix changed to \`${newPrefix}\``, flags: MessageFlags.Ephemeral }).catch(() => {});
      });
    } else {
      await interaction.reply({ content: "Invalid prefix. Please use 1-5 characters.", flags: MessageFlags.Ephemeral }).catch(() => {});
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
    await interaction.reply({ content: "Welcome embed updated.", embeds: [buildWelcomeEmbed(config)], components: buildWelcomeRows(true), flags: MessageFlags.Ephemeral }).catch(() => {});
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
    await interaction.reply({ content: "Goodbye embed updated.", embeds: [buildGoodbyeEmbed(config)], components: buildGoodbyeRows(true), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  return false;
}

