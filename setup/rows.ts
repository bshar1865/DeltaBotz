import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { buildSetupMenuRow } from "../utils/setupUi";

export function buildMainRows() {
  return [buildSetupMenuRow()];
}

export function buildPermissionsRows(includeBack?: boolean) {
  const toggleModCommands = new ButtonBuilder()
    .setCustomId("toggle_moderator_commands")
    .setLabel("Toggle Mod Commands")
    .setStyle(ButtonStyle.Primary);

  const rows: any[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(toggleModCommands)];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildPrefixRows(includeBack?: boolean) {
  const changePrefixButton = new ButtonBuilder()
    .setCustomId("change_prefix")
    .setLabel("Change Prefix")
    .setStyle(ButtonStyle.Primary);

  const resetPrefixButton = new ButtonBuilder()
    .setCustomId("reset_prefix")
    .setLabel("Reset")
    .setStyle(ButtonStyle.Secondary);

  const rows: any[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(changePrefixButton, resetPrefixButton)];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildRoleRows(includeBack?: boolean) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("setup_role_mods")
    .setPlaceholder("Select Mod roles")
    .setMinValues(0)
    .setMaxValues(10);
  const rows: any[] = [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect)];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildLoggingRows(includeBack?: boolean) {
  const logChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("setup_log_channel")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setPlaceholder("Select Moderation log channel")
    .setMinValues(0)
    .setMaxValues(1);

  const msgChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("setup_message_log_channel")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setPlaceholder("Select Message log channel")
    .setMinValues(0)
    .setMaxValues(1);

  const memberChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("setup_member_log_channel")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setPlaceholder("Select Member log channel")
    .setMinValues(0)
    .setMaxValues(1);

  const rows: any[] = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(logChannelSelect),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(msgChannelSelect),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(memberChannelSelect),
  ];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildHoneypotRows(includeBack?: boolean) {
  const toggleHoneypot = new ButtonBuilder()
    .setCustomId("toggle_honeypot")
    .setLabel("Toggle Honeypot")
    .setStyle(ButtonStyle.Primary);
  const toggleAutoUnban = new ButtonBuilder()
    .setCustomId("toggle_honeypot_autounban")
    .setLabel("Toggle Auto Unban")
    .setStyle(ButtonStyle.Secondary);
  const honeypotSelect = new ChannelSelectMenuBuilder()
    .setCustomId("setup_honeypot_channel")
    .setChannelTypes(ChannelType.GuildText)
    .setPlaceholder("Select honeypot channel")
    .setMinValues(0)
    .setMaxValues(1);

  const rows: any[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggleHoneypot, toggleAutoUnban),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(honeypotSelect),
  ];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildWelcomeRows(includeBack?: boolean) {
  const toggle = new ButtonBuilder().setCustomId("toggle_welcome").setLabel("Toggle Welcome").setStyle(ButtonStyle.Primary);
  const edit = new ButtonBuilder().setCustomId("edit_welcome_embed").setLabel("Edit Embed").setStyle(ButtonStyle.Secondary);
  const reset = new ButtonBuilder().setCustomId("reset_welcome_embed").setLabel("Reset").setStyle(ButtonStyle.Secondary);
  const channel = new ChannelSelectMenuBuilder()
    .setCustomId("setup_welcome_channel")
    .setChannelTypes(ChannelType.GuildText)
    .setPlaceholder("Select welcome channel")
    .setMinValues(0)
    .setMaxValues(1);
  const rows: any[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggle, edit, reset),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channel),
  ];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildGoodbyeRows(includeBack?: boolean) {
  const toggle = new ButtonBuilder().setCustomId("toggle_goodbye").setLabel("Toggle Goodbye").setStyle(ButtonStyle.Primary);
  const edit = new ButtonBuilder().setCustomId("edit_goodbye_embed").setLabel("Edit Embed").setStyle(ButtonStyle.Secondary);
  const reset = new ButtonBuilder().setCustomId("reset_goodbye_embed").setLabel("Reset").setStyle(ButtonStyle.Secondary);
  const channel = new ChannelSelectMenuBuilder()
    .setCustomId("setup_goodbye_channel")
    .setChannelTypes(ChannelType.GuildText)
    .setPlaceholder("Select goodbye channel")
    .setMinValues(0)
    .setMaxValues(1);
  const rows: any[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggle, edit, reset),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channel),
  ];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildRoleRestoreRows(includeBack?: boolean) {
  const toggleRestore = new ButtonBuilder().setCustomId("toggle_restore").setLabel("Toggle Role Restore").setStyle(ButtonStyle.Secondary);
  const rows: any[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(toggleRestore)];
  if (includeBack) rows.push(backRow());
  return rows;
}

export function buildAutoModerationRows(includeBack?: boolean) {
  const toggleAutoEmbed = new ButtonBuilder().setCustomId("toggle_auto_embed").setLabel("Toggle Auto Embed").setStyle(ButtonStyle.Secondary);
  const toggleInviteBlock = new ButtonBuilder().setCustomId("toggle_invite_block").setLabel("Toggle Invite Block").setStyle(ButtonStyle.Secondary);
  const rows: any[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(toggleAutoEmbed, toggleInviteBlock)];
  if (includeBack) rows.push(backRow());
  return rows;
}

function backRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("setup_back").setLabel("Back").setStyle(ButtonStyle.Secondary),
  );
}

