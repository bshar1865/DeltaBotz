import { Events, Interaction, StringSelectMenuInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType } from "discord.js";
import { logError } from "../utils/errorLogger";
import { ExtendedClient } from "../utils/ExtendedClient";
import configManager from "../utils/ConfigManager";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, client: ExtendedClient) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(interaction, client);
        } catch (err) {
          console.error(`Error in slash command ${interaction.commandName}:`, err);

          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "Something went wrong while executing this command.",
              ephemeral: true,
            }).catch(() => {});
          }
        }
      } else if (interaction.isStringSelectMenu()) {
        // Handle setup menu selections
        if (interaction.customId === 'setup_menu') {
          // Admin-only guard
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', ephemeral: true }).catch(() => {});
            return;
          }
          await handleSetupMenu(interaction as StringSelectMenuInteraction);
        }
        // no duration selection needed (auto-unban fixed at 10s)
      } else if (interaction.isRoleSelectMenu()) {
        if (interaction.customId === 'setup_role_mods') {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', ephemeral: true }).catch(() => {});
            return;
          }
          const guild = interaction.guild!;
          const config = await configManager.getOrCreateConfig(guild);
          const roleIds = interaction.values as string[];
          config.permissions.moderatorRoles = roleIds;
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          const rows = interaction.message?.components;
          if (rows) {
            await interaction.update({ embeds: [embed], components: rows }).catch(() => {});
          } else {
            await interaction.update({ embeds: [embed] }).catch(() => {});
          }
        }
      } else if (interaction.isChannelSelectMenu()) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: 'You need Administrator to use setup.', ephemeral: true }).catch(() => {});
          return;
        }
        const guild = interaction.guild!;
        const config = await configManager.getOrCreateConfig(guild);
        const channelId = interaction.values[0];
        if (interaction.customId === 'setup_log_channel') {
          config.logging = { ...(config.logging || {}), logChannelId: channelId } as any;
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          await interaction.update({ embeds: [embed], components: buildLoggingRows(true) }).catch(() => {});
        }
        if (interaction.customId === 'setup_honeypot_channel') {
          config.features = {
            ...(config.features || {}),
            honeypot: {
              ...((config.features && (config.features as any).honeypot) || { enabled: true, deleteMessage: true, autoUnban: false }),
              enabled: Boolean(channelId),
              channelId,
              autoBan: Boolean(channelId),
            },
          } as any;
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          await interaction.update({ embeds: [embed], components: buildHoneypotRows(true) }).catch(() => {});
        }
        if (interaction.customId === 'setup_welcome_channel') {
          (config.features as any).welcome = { ...((config.features as any).welcome||{}), channelId };
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          await interaction.update({ embeds: [embed], components: buildFeaturesRows(true) }).catch(() => {});
        }
        if (interaction.customId === 'setup_goodbye_channel') {
          (config.features as any).goodbye = { ...((config.features as any).goodbye||{}), channelId };
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          await interaction.update({ embeds: [embed], components: buildFeaturesRows(true) }).catch(() => {});
        }
      }
      else if (interaction.isButton()) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: 'You need Administrator to use setup.', ephemeral: true }).catch(() => {});
          return;
        }
        const guild = interaction.guild!;
        const config = await configManager.getOrCreateConfig(guild);
        if (interaction.customId === 'setup_back') {
          const embed = new EmbedBuilder().setTitle('Setup').setDescription('Select a section to view').setColor('#0099ff').setTimestamp();
          await interaction.update({ embeds: [embed], components: buildMainRows() }).catch(() => {});
          return;
        }
        if (interaction.customId === 'toggle_welcome') {
          (config.features as any).welcome = { ...((config.features as any).welcome||{}), enabled: !(config.features as any)?.welcome?.enabled };
        }
        if (interaction.customId === 'toggle_goodbye') {
          (config.features as any).goodbye = { ...((config.features as any).goodbye||{}), enabled: !(config.features as any)?.goodbye?.enabled };
        }
        if (interaction.customId === 'toggle_restore') {
          (config.features as any).roleRestore = { ...((config.features as any).roleRestore||{}), enabled: !(config.features as any)?.roleRestore?.enabled };
        }
        if (interaction.customId === 'toggle_honeypot_autounban') {
          (config.features as any).honeypot = { ...((config.features as any).honeypot||{}), autoUnban: !((config.features as any)?.honeypot?.autoUnban) };
        }
        if (interaction.customId === 'toggle_honeypot_delete') {
          (config.features as any).honeypot = { ...((config.features as any).honeypot||{}), deleteMessage: !((config.features as any)?.honeypot?.deleteMessage) };
        }
        await configManager.saveServerConfig(config);
        const embed = buildSetupEmbed(config);
        if (interaction.customId.startsWith('toggle_honeypot')) {
          await interaction.update({ embeds: [embed], components: buildHoneypotRows(true) }).catch(() => {});
        } else {
          await interaction.update({ embeds: [embed], components: buildFeaturesRows(true) }).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Error in InteractionCreate:", error);
      try { await logError(error instanceof Error ? error : String(error), 'events/interactionCreate', { userId: (interaction as any).user?.id, guildId: (interaction as any).guildId }, client as any, (interaction as any).guild); } catch {}
    }
  },
};

async function handleSetupMenu(interaction: StringSelectMenuInteraction) {
  if (!interaction.guild) return;
  const value = interaction.values[0];
  const config = await configManager.getOrCreateConfig(interaction.guild);

  let embed = new EmbedBuilder().setColor('#0099ff').setTimestamp().setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
  let rows: any[] | undefined;

  switch (value) {
    case 'roles':
      embed
        .setTitle('Mod roles')
        .setDescription(((config.permissions?.moderatorRoles?.length ? config.permissions.moderatorRoles.map(r => `<@&${r}>`).join(', ') : 'None')) + '\n\nNote: Re-select roles (including previously selected) to ensure they are included.');
      rows = buildRoleRows(true);
      break;
    case 'roles_edit':
      // No-op here; role selection handled by RoleSelectMenu
      break;
    case 'logging':
      embed
        .setTitle('Logging')
        .addFields(
          { name: 'Enabled', value: config.logging?.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Log Channel', value: config.logging?.logChannelId ? `<#${config.logging.logChannelId}>` : 'Not set', inline: true }
        );
      rows = buildLoggingRows(true);
      break;
    case 'honeypot':
      embed
        .setTitle('Honeypot')
        .addFields(
          { name: 'Enabled', value: (config.features as any)?.honeypot?.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Channel', value: (config.features as any)?.honeypot?.channelId ? `<#${(config.features as any).honeypot.channelId}>` : 'Not set', inline: true },
          { name: 'Auto Unban', value: (config.features as any)?.honeypot?.autoUnban ? 'Yes' : 'No', inline: true },
          { name: 'Delete Messages', value: (config.features as any)?.honeypot?.deleteMessage ? 'Yes' : 'No', inline: true },
        );
      rows = buildHoneypotRows(true);
      break;
    case 'features':
      embed
        .setTitle('Features')
        .addFields(
          { name: 'Welcome', value: (config.features as any)?.welcome?.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Goodbye', value: (config.features as any)?.goodbye?.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Role Restore', value: (config.features as any)?.roleRestore?.enabled ? 'Enabled' : 'Disabled', inline: true },
        )
        .setFooter({ text: 'Note: Role Restore acts as a role logger; it stores a user\'s roles on leave and restores them when they rejoin.' });
      rows = buildFeaturesRows(true);
      break;
    default:
      embed.setTitle('Setup').setDescription('Select a section from the menu.');
      rows = buildMainRows();
  }

  // Update the original menu message (avoids ephemeral flag warning)
  await interaction.update({ embeds: [embed], components: rows ?? interaction.message?.components }).catch(() => {});
}

function buildSetupEmbed(config: any): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(', ') : 'None';
  const embed = new EmbedBuilder()
    .setTitle('Setup')
    .setColor('#0099ff')
    .addFields(
      { name: 'Prefix', value: String(config.prefix || '.'), inline: true },
      { name: 'Logging', value: (config.logging?.enabled ? 'Enabled' : 'Disabled'), inline: true },
      { name: 'Log Channel', value: (config.logging?.logChannelId ? `<#${config.logging.logChannelId}>` : 'Not set'), inline: true },
      { name: 'Honeypot', value: ((config.features as any)?.honeypot?.enabled ? `Enabled in <#${(config.features as any).honeypot.channelId}>` : 'Disabled'), inline: false },
      { name: 'Welcome Channel', value: ((config.features as any)?.welcome?.channelId ? `<#${(config.features as any).welcome.channelId}>` : 'Not set'), inline: true },
      { name: 'Goodbye Channel', value: ((config.features as any)?.goodbye?.channelId ? `<#${(config.features as any).goodbye.channelId}>` : 'Not set'), inline: true },
      { name: 'Mod roles', value: modRolesDisplay, inline: false },
    )
    .setTimestamp();
  return embed;
}

// Build per-section rows
function buildMainRows() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup_menu')
    .setPlaceholder('Select a section to view')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Mod roles').setValue('roles').setDescription('View moderator roles'),
      new StringSelectMenuOptionBuilder().setLabel('Logging').setValue('logging').setDescription('View logging settings'),
      new StringSelectMenuOptionBuilder().setLabel('Honeypot').setValue('honeypot').setDescription('View honeypot settings'),
      new StringSelectMenuOptionBuilder().setLabel('Features').setValue('features').setDescription('View feature toggles'),
    );
  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

function buildRoleRows(includeBack?: boolean) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('setup_role_mods')
    .setPlaceholder('Select Mod roles')
    .setMinValues(0)
    .setMaxValues(10);
  const rows: any[] = [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect)];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}

function buildLoggingRows(includeBack?: boolean) {
  const logChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('setup_log_channel')
    .setChannelTypes(ChannelType.GuildText)
    .setPlaceholder('Select Log channel')
    .setMinValues(0)
    .setMaxValues(1);
  const rows: any[] = [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(logChannelSelect)];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}

function buildHoneypotRows(includeBack?: boolean) {
  const honeypotSelect = new ChannelSelectMenuBuilder()
    .setCustomId('setup_honeypot_channel')
    .setChannelTypes(ChannelType.GuildText)
    .setPlaceholder('Select Honeypot channel')
    .setMinValues(0)
    .setMaxValues(1);
  const toggles = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('toggle_honeypot_autounban').setLabel('Toggle Auto-unban').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('toggle_honeypot_delete').setLabel('Toggle Delete Msgs').setStyle(ButtonStyle.Secondary),
  );
  const rows: any[] = [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(honeypotSelect), toggles];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}

function buildFeaturesRows(includeBack?: boolean) {
  // Buttons to toggle features
  const toggleWelcome = new ButtonBuilder().setCustomId('toggle_welcome').setLabel('Toggle Welcome').setStyle(ButtonStyle.Secondary);
  const toggleGoodbye = new ButtonBuilder().setCustomId('toggle_goodbye').setLabel('Toggle Goodbye').setStyle(ButtonStyle.Secondary);
  const toggleRestore = new ButtonBuilder().setCustomId('toggle_restore').setLabel('Toggle Role Restore').setStyle(ButtonStyle.Secondary);
  const welcomeChannel = new ChannelSelectMenuBuilder().setCustomId('setup_welcome_channel').setChannelTypes(ChannelType.GuildText).setPlaceholder('Select Welcome channel').setMinValues(0).setMaxValues(1);
  const goodbyeChannel = new ChannelSelectMenuBuilder().setCustomId('setup_goodbye_channel').setChannelTypes(ChannelType.GuildText).setPlaceholder('Select Goodbye channel').setMinValues(0).setMaxValues(1);
  const rows: any[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggleWelcome, toggleGoodbye, toggleRestore),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(welcomeChannel),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(goodbyeChannel),
  ];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}
