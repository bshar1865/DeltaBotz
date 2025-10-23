import { Events, Interaction, StringSelectMenuInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { logError } from "../utils/errorLogger";
import { ExtendedClient } from "../utils/ExtendedClient";
import configManager from "../utils/ConfigManager";
import idclass from "../utils/idclass";
import { ServerConfig } from "../types/config";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, client: ExtendedClient) {
    try {
      // Check if interaction is too old (expired)
      const interactionAge = Date.now() - interaction.createdTimestamp;
      if (interactionAge > 3000) { // 3 seconds
        console.log('Interaction expired, ignoring');
        return;
      }
      if (interaction.isChatInputCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(interaction, client);
        } catch (err) {
          console.error(`Error in slash command ${interaction.commandName}:`, err);
          try { await logError(err instanceof Error ? err : String(err), `slash:${interaction.commandName}`, undefined, client as any, (interaction as any).guild); } catch {}

          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "Something went wrong while executing this command.",
              flags: 64, // MessageFlags.Ephemeral
            }).catch(() => {});
          }
        }
      } else if (interaction.isStringSelectMenu()) {
        // Handle setup menu selections
        if (interaction.customId === 'setup_menu') {
          // Admin-only guard
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: 64 }).catch(() => {});
            return;
          }
          await handleSetupMenu(interaction as StringSelectMenuInteraction);
        }
        // no duration selection needed (auto-unban fixed at 10s)
      } else if (interaction.isRoleSelectMenu()) {
        if (interaction.customId === 'setup_role_mods') {
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: 64 }).catch(() => {});
            return;
          }
          const guild = interaction.guild!;
          const config = await configManager.getOrCreateConfig(guild);
          const roleIds = interaction.values as string[];
          config.permissions.moderatorRoles = roleIds;
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          const rows = interaction.message?.components;
          try {
            if (rows) {
              await interaction.update({ embeds: [embed], components: rows });
            } else {
              await interaction.update({ embeds: [embed] });
            }
          } catch (error) {
            console.error('Failed to update role selection:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping role update response');
              return;
            }
            await interaction.followUp({ content: 'Roles updated but failed to refresh display.', flags: 64 });
          }
        }
      } else if (interaction.isChannelSelectMenu()) {
        const isOwner = (interaction as any).user?.id === idclass.ownershipID();
        if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: 'You need Administrator to use setup.', flags: 64 }).catch(() => {});
          return;
        }
        const guild = interaction.guild!;
        const config = await configManager.getOrCreateConfig(guild);
        const channelId = interaction.values[0];
        if (interaction.customId === 'setup_log_channel') {
          config.logging = { ...(config.logging || {}), logChannelId: channelId };
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildLoggingRows(true) });
          } catch (error) {
            console.error('Failed to update log channel:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping log channel update response');
              return;
            }
            await interaction.followUp({ content: 'Log channel set but failed to update display.', flags: 64 });
          }
        }
        if (interaction.customId === 'setup_honeypot_channel') {
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
          const embed = buildSetupEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildHoneypotRows(true) });
          } catch (error) {
            console.error('Failed to update honeypot channel:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping honeypot channel update response');
              return;
            }
            await interaction.followUp({ content: 'Honeypot channel set but failed to update display.', flags: 64 });
          }
        }
        if (interaction.customId === 'setup_welcome_channel') {
          config.features.welcome = { ...(config.features.welcome || {}), channelId };
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildFeaturesRows(true) });
          } catch (error) {
            console.error('Failed to update welcome channel:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping welcome channel update response');
              return;
            }
            await interaction.followUp({ content: 'Welcome channel set but failed to update display.', flags: 64 });
          }
        }
        if (interaction.customId === 'setup_goodbye_channel') {
          config.features.goodbye = { ...(config.features.goodbye || {}), channelId };
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildFeaturesRows(true) });
          } catch (error) {
            console.error('Failed to update goodbye channel:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping goodbye channel update response');
              return;
            }
            await interaction.followUp({ content: 'Goodbye channel set but failed to update display.', flags: 64 });
          }
        }
      }
      else if (interaction.isButton()) {
        const isOwner = (interaction as any).user?.id === idclass.ownershipID();
        if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: 'You need Administrator to use setup.', flags: 64 }).catch(() => {});
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
          config.features.welcome = { ...(config.features.welcome || {}), enabled: !config.features?.welcome?.enabled };
        }
        if (interaction.customId === 'toggle_goodbye') {
          config.features.goodbye = { ...(config.features.goodbye || {}), enabled: !config.features?.goodbye?.enabled };
        }
        if (interaction.customId === 'toggle_restore') {
          config.features.roleRestore = { ...(config.features.roleRestore || {}), enabled: !config.features?.roleRestore?.enabled };
        }
        if (interaction.customId === 'toggle_honeypot_autounban') {
          config.features.honeypot = { ...(config.features.honeypot || {}), autoUnban: !config.features?.honeypot?.autoUnban };
        }
        if (interaction.customId === 'toggle_honeypot_delete') {
          config.features.honeypot = { ...(config.features.honeypot || {}), deleteMessage: !config.features?.honeypot?.deleteMessage };
        }
        if (interaction.customId === 'change_prefix') {
          // Create a modal for prefix input
          const modal = new ModalBuilder()
            .setCustomId('prefix_modal')
            .setTitle('Change Bot Prefix');

          const prefixInput = new TextInputBuilder()
            .setCustomId('prefix_input')
            .setLabel('New Prefix (1-5 characters)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter new prefix...')
            .setValue(config.prefix)
            .setRequired(true)
            .setMaxLength(5)
            .setMinLength(1);

          const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(prefixInput);
          modal.addComponents(actionRow);

          try {
            await interaction.showModal(modal);
          } catch (error) {
            console.error('Failed to show prefix modal:', error);
            // Fallback to regular message
            const channel = interaction.channel;
            if (channel && 'send' in channel) {
              await (channel as any).send('Please send the new prefix in this channel. It should be 1-5 characters long.');
            }
          }
          return;
        }
        if (interaction.customId === 'reset_prefix') {
          config.prefix = '.';
          await configManager.saveServerConfig(config);
          const embed = buildSetupEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildPrefixRows(true) });
          } catch (error) {
            console.error('Failed to update prefix reset:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping prefix reset response');
              return;
            }
            await interaction.followUp({ content: 'Prefix reset but failed to update display. Please refresh.', flags: 64 });
          }
          return;
        }
        
        await configManager.saveServerConfig(config);
        const embed = buildSetupEmbed(config);
        
        try {
          // Check if interaction is still valid
          if (interaction.replied || interaction.deferred) {
            // If already responded, use followUp
            await interaction.followUp({ 
              content: 'Settings updated successfully!', 
              flags: 64
            });
          } else {
            // If not responded yet, use update
            if (interaction.customId.startsWith('toggle_honeypot')) {
              await interaction.update({ embeds: [embed], components: buildHoneypotRows(true) });
            } else if (interaction.customId.startsWith('toggle_')) {
              await interaction.update({ embeds: [embed], components: buildFeaturesRows(true) });
            } else {
              // Fallback for other button interactions
              await interaction.update({ embeds: [embed] });
            }
          }
        } catch (error) {
          console.error('Failed to update button interaction:', error);
          // Don't try to respond to expired interactions
          if ((error as any).code === 10062) {
            console.log('Interaction expired, skipping response');
            return;
          }
          
          if (!interaction.replied && !interaction.deferred) {
            try {
              await interaction.reply({ 
                content: 'Settings updated but failed to refresh display. Please use /setup again.', 
                flags: 64
              });
            } catch (replyError) {
              console.error('Failed to send error reply:', replyError);
            }
          }
        }
      } else if (interaction.isModalSubmit()) {
        // Handle modal submissions
        if (interaction.customId === 'prefix_modal') {
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: 64 }).catch(() => {});
            return;
          }
          
          const guild = interaction.guild!;
          const config = await configManager.getOrCreateConfig(guild);
          const newPrefix = interaction.fields.getTextInputValue('prefix_input');
          
          if (newPrefix && newPrefix.length >= 1 && newPrefix.length <= 5) {
            config.prefix = newPrefix;
            await configManager.saveServerConfig(config);
            
            const embed = buildSetupEmbed(config);
            try {
              await interaction.reply({
                content: `✅ Prefix changed to \`${newPrefix}\``,
                embeds: [embed],
                components: buildPrefixRows(true),
                flags: 64
              });
            } catch (error) {
              console.error('Failed to reply to prefix modal:', error);
              // If reply failed, try followUp only if we already replied
              if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                  content: `✅ Prefix changed to \`${newPrefix}\``,
                  flags: 64
                });
              } else {
                // If we can't reply at all, just log the error
                console.error('Cannot respond to modal interaction');
              }
            }
          } else {
            try {
              await interaction.reply({
                content: '❌ Invalid prefix. Please use 1-5 characters.',
                flags: 64
              });
            } catch (error) {
              console.error('Failed to reply to prefix modal error:', error);
              // If reply failed, try followUp only if we already replied
              if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                  content: '❌ Invalid prefix. Please use 1-5 characters.',
                  flags: 64
                });
              } else {
                // If we can't reply at all, just log the error
                console.error('Cannot respond to modal interaction');
              }
            }
          }
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
    case 'prefix':
      embed
        .setTitle('Prefix Settings')
        .setDescription(`Current prefix: \`${config.prefix}\`\n\nUse the button below to change the bot's prefix for this server.`);
      rows = buildPrefixRows(true);
      break;
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
          { name: 'Enabled', value: config.features?.honeypot?.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Channel', value: config.features?.honeypot?.channelId ? `<#${config.features.honeypot.channelId}>` : 'Not set', inline: true },
          { name: 'Auto Unban', value: config.features?.honeypot?.autoUnban ? 'Yes' : 'No', inline: true },
          { name: 'Delete Messages', value: config.features?.honeypot?.deleteMessage ? 'Yes' : 'No', inline: true },
        );
      rows = buildHoneypotRows(true);
      break;
    case 'features':
      embed
        .setTitle('Features')
        .addFields(
          { name: 'Welcome', value: config.features?.welcome?.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Goodbye', value: config.features?.goodbye?.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Role Restore', value: config.features?.roleRestore?.enabled ? 'Enabled' : 'Disabled', inline: true },
        )
        .setFooter({ text: 'Note: Role Restore acts as a role logger; it stores a user\'s roles on leave and restores them when they rejoin.' });
      rows = buildFeaturesRows(true);
      break;
    default:
      embed.setTitle('Setup').setDescription('Select a section from the menu.');
      rows = buildMainRows();
  }

  // Update the original menu message with proper error handling
  try {
    if (rows) {
      await interaction.update({ embeds: [embed], components: rows });
    } else {
      await interaction.update({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Failed to update setup menu:', error);
    try {
      await interaction.followUp({ 
        content: 'Failed to update the setup menu. Please try again.', 
        flags: 64 
      });
    } catch (followUpError) {
      console.error('Failed to send follow-up message:', followUpError);
    }
  }
}

function buildSetupEmbed(config: ServerConfig): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(', ') : 'None';
  const embed = new EmbedBuilder()
    .setTitle('Setup')
    .setColor('#0099ff')
    .addFields(
      { name: 'Prefix', value: `\`${config.prefix || '.'}\``, inline: true },
      { name: 'Logging', value: (config.logging?.enabled ? 'Enabled' : 'Disabled'), inline: true },
      { name: 'Log Channel', value: (config.logging?.logChannelId ? `<#${config.logging.logChannelId}>` : 'Not set'), inline: true },
      { name: 'Honeypot', value: (config.features?.honeypot?.enabled ? `Enabled in <#${config.features.honeypot.channelId}>` : 'Disabled'), inline: false },
      { name: 'Welcome Channel', value: (config.features?.welcome?.channelId ? `<#${config.features.welcome.channelId}>` : 'Not set'), inline: true },
      { name: 'Goodbye Channel', value: (config.features?.goodbye?.channelId ? `<#${config.features.goodbye.channelId}>` : 'Not set'), inline: true },
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
      new StringSelectMenuOptionBuilder().setLabel('Prefix').setValue('prefix').setDescription('Set custom bot prefix'),
      new StringSelectMenuOptionBuilder().setLabel('Mod roles').setValue('roles').setDescription('View moderator roles'),
      new StringSelectMenuOptionBuilder().setLabel('Logging').setValue('logging').setDescription('View logging settings'),
      new StringSelectMenuOptionBuilder().setLabel('Honeypot').setValue('honeypot').setDescription('View honeypot settings'),
      new StringSelectMenuOptionBuilder().setLabel('Features').setValue('features').setDescription('View feature toggles'),
    );
  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

function buildPrefixRows(includeBack?: boolean) {
  const changePrefixButton = new ButtonBuilder()
    .setCustomId('change_prefix')
    .setLabel('Change Prefix')
    .setStyle(ButtonStyle.Primary);
  
  const resetPrefixButton = new ButtonBuilder()
    .setCustomId('reset_prefix')
    .setLabel('Reset to Default')
    .setStyle(ButtonStyle.Secondary);
  
  const rows: any[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(changePrefixButton, resetPrefixButton)];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
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
