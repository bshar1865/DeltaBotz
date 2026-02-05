import { Events, Interaction, StringSelectMenuInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { logError } from "../utils/errorLogger";
import { ExtendedClient } from "../client";
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
          const embed = buildRoleEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildRoleRows(true) });
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
          const embed = buildLoggingEmbed(config);
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
          const embed = buildHoneypotEmbed(config);
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
          const embed = buildWelcomeRoleEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildWelcomeRoleRows(true) });
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
          const embed = buildWelcomeRoleEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildWelcomeRoleRows(true) });
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
          const embed = buildMainEmbed(config);
          await interaction.update({ embeds: [embed], components: buildMainRows() }).catch(() => {});
          return;
        }
        if (interaction.customId === 'toggle_welcome') {
          config.features.welcome = { ...(config.features.welcome || {}), enabled: !config.features?.welcome?.enabled };
          await configManager.saveServerConfig(config);
          const embed = buildWelcomeRoleEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildWelcomeRoleRows(true) });
          } catch (error) {
            console.error('Failed to update welcome toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
        }
        if (interaction.customId === 'toggle_goodbye') {
          config.features.goodbye = { ...(config.features.goodbye || {}), enabled: !config.features?.goodbye?.enabled };
          await configManager.saveServerConfig(config);
          const embed = buildWelcomeRoleEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildWelcomeRoleRows(true) });
          } catch (error) {
            console.error('Failed to update goodbye toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
        }
        if (interaction.customId === 'toggle_restore') {
          config.features.roleRestore = { ...(config.features.roleRestore || {}), enabled: !config.features?.roleRestore?.enabled };
          await configManager.saveServerConfig(config);
          const embed = buildWelcomeRoleEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildWelcomeRoleRows(true) });
          } catch (error) {
            console.error('Failed to update restore toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
        }
        if (interaction.customId === 'toggle_auto_embed') {
          config.features.autoEmbed = { ...(config.features.autoEmbed || {}), enabled: !config.features?.autoEmbed?.enabled };
          await configManager.saveServerConfig(config);
          const embed = buildAutoModerationEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildAutoModerationRows(true) });
          } catch (error) {
            console.error('Failed to update auto embed toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
        }
        if (interaction.customId === 'toggle_invite_block') {
          config.features.inviteBlock = { ...(config.features.inviteBlock || {}), enabled: !config.features?.inviteBlock?.enabled };
          await configManager.saveServerConfig(config);
          const embed = buildAutoModerationEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildAutoModerationRows(true) });
          } catch (error) {
            console.error('Failed to update invite block toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
        }
        if (interaction.customId === 'toggle_moderator_commands') {
          config.permissions.moderatorCommandsEnabled = !(config.permissions.moderatorCommandsEnabled ?? true);
          await configManager.saveServerConfig(config);
          const embed = buildPermissionsEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildPermissionsRows(true) });
          } catch (error) {
            console.error('Failed to update moderator commands toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
        }
        if (interaction.customId === 'toggle_honeypot_autounban') {
          config.features.honeypot = { ...(config.features.honeypot || {}), autoUnban: !config.features?.honeypot?.autoUnban };
          await configManager.saveServerConfig(config);
          const embed = buildHoneypotEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildHoneypotRows(true) });
          } catch (error) {
            console.error('Failed to update honeypot autounban toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
        }
        if (interaction.customId === 'toggle_honeypot_delete') {
          config.features.honeypot = { ...(config.features.honeypot || {}), deleteMessage: !config.features?.honeypot?.deleteMessage };
          await configManager.saveServerConfig(config);
          const embed = buildHoneypotEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildHoneypotRows(true) });
          } catch (error) {
            console.error('Failed to update honeypot delete toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: 64 });
          }
          return;
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
          const embed = buildPrefixEmbed(config);
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
            
            const embed = buildPrefixEmbed(config);
            try {
              await interaction.reply({
                content: `Prefix changed to \`${newPrefix}\``,
                embeds: [embed],
                components: buildPrefixRows(true),
                flags: 64
              });
            } catch (error) {
              console.error('Failed to reply to prefix modal:', error);
              // If reply failed, try followUp only if we already replied
              if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                  content: `Prefix changed to \`${newPrefix}\``,
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
                content: 'Invalid prefix. Please use 1-5 characters.',
                flags: 64
              });
            } catch (error) {
              console.error('Failed to reply to prefix modal error:', error);
              // If reply failed, try followUp only if we already replied
              if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                  content: 'Invalid prefix. Please use 1-5 characters.',
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
      embed = buildPrefixEmbed(config);
      rows = buildPrefixRows(true);
      break;
    case 'roles':
      embed = buildRoleEmbed(config);
      rows = buildRoleRows(true);
      break;
    case 'permissions':
      embed = buildPermissionsEmbed(config);
      rows = buildPermissionsRows(true);
      break;
    case 'logging':
      embed = buildLoggingEmbed(config);
      rows = buildLoggingRows(true);
      break;
    case 'honeypot':
      embed = buildHoneypotEmbed(config);
      rows = buildHoneypotRows(true);
      break;
    case 'welcome_role':
      embed = buildWelcomeRoleEmbed(config);
      rows = buildWelcomeRoleRows(true);
      break;
    case 'auto_moderation':
      embed = buildAutoModerationEmbed(config);
      rows = buildAutoModerationRows(true);
      break;
    default:
      embed = buildMainEmbed(config);
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

function buildMainEmbed(config: ServerConfig): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(', ') : 'None';
  const embed = new EmbedBuilder()
    .setTitle('Setup')
    .setDescription('Use the menu below to configure the bot. Changes save instantly when you select.\nNote: Re-select roles (including previously selected) to ensure they are included.')
    .setColor('#0099ff')
    .addFields(
      { name: 'Prefix', value: `\`${config.prefix || '.'}\``, inline: true },
      { name: 'Logging', value: (config.logging?.enabled ? 'Enabled' : 'Disabled'), inline: true },
      { name: 'Honeypot', value: (config.features?.honeypot?.enabled ? 'Enabled' : 'Disabled'), inline: true },
      { name: 'Mod Commands', value: (config.permissions?.moderatorCommandsEnabled ?? true) ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Mod roles', value: modRolesDisplay, inline: false },
    )
    .setTimestamp()
    .setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
  return embed;
}

function buildPrefixEmbed(config: ServerConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Prefix Settings')
    .setDescription(`Current prefix: \`${config.prefix || '.'}\`\n\nUse the button below to change the bot's prefix for this server.`)
    .setColor('#0099ff')
    .setTimestamp()
    .setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
}

function buildRoleEmbed(config: ServerConfig): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(', ') : 'None';
  return new EmbedBuilder()
    .setTitle('Mod roles')
    .setDescription(`${modRolesDisplay}\n\nNote: Re-select roles (including previously selected) to ensure they are included.`)
    .setColor('#0099ff')
    .setTimestamp()
    .setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
}

function buildPermissionsEmbed(config: ServerConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Mod Commands')
    .setDescription('Enable or disable all moderator commands for this server.')
    .setColor('#0099ff')
    .addFields(
      { name: 'Status', value: (config.permissions?.moderatorCommandsEnabled ?? true) ? 'Enabled' : 'Disabled', inline: false },
      { name: 'Note', value: 'When disabled, the bot will completely ignore all mod commands (no response). This applies to everyone, including the server owner.', inline: false },
    )
    .setTimestamp()
    .setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
}

function buildLoggingEmbed(config: ServerConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Logging')
    .setColor('#0099ff')
    .addFields(
      { name: 'Enabled', value: config.logging?.enabled ? 'Yes' : 'No', inline: true },
      { name: 'Log Channel', value: config.logging?.logChannelId ? `<#${config.logging.logChannelId}>` : 'Not set', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
}

function buildHoneypotEmbed(config: ServerConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Honeypot')
    .setColor('#0099ff')
    .addFields(
      { name: 'Enabled', value: config.features?.honeypot?.enabled ? 'Yes' : 'No', inline: true },
      { name: 'Channel', value: config.features?.honeypot?.channelId ? `<#${config.features.honeypot.channelId}>` : 'Not set', inline: true },
      { name: 'Auto Unban', value: config.features?.honeypot?.autoUnban ? 'Yes' : 'No', inline: true },
      { name: 'Delete Messages', value: config.features?.honeypot?.deleteMessage ? 'Yes' : 'No', inline: true },
    )
    .setTimestamp()
    .setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
}

function buildWelcomeRoleEmbed(config: ServerConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Welcome & Role restoration')
    .setColor('#0099ff')
    .addFields(
      { name: 'Welcome', value: config.features?.welcome?.enabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Goodbye', value: config.features?.goodbye?.enabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Role Restore', value: config.features?.roleRestore?.enabled ? 'Enabled' : 'Disabled', inline: true },
    )
    .setFooter({ text: 'Note: Role Restore acts as a role logger; it stores a user\'s roles on leave and restores them when they rejoin.' })
    .setTimestamp();
}

function buildAutoModerationEmbed(config: ServerConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Others')
    .setColor('#0099ff')
    .addFields(
      { name: 'Auto Embed', value: config.features?.autoEmbed?.enabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Invite Block', value: config.features?.inviteBlock?.enabled ? 'Enabled' : 'Disabled', inline: true },
    )
    .setFooter({ text: 'Auto Embed converts Instagram links to embeddable format. Invite Block deletes Discord invite links (mods are exempt).' })
    .setTimestamp();
}

// Build per-section rows
function buildMainRows() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup_menu')
    .setPlaceholder('Select a section to view')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Prefix').setValue('prefix').setDescription('Set custom bot prefix'),
      new StringSelectMenuOptionBuilder().setLabel('Mod roles').setValue('roles').setDescription('View moderator roles'),
      new StringSelectMenuOptionBuilder().setLabel('Mod Commands').setValue('permissions').setDescription('Enable/disable moderator commands'),
      new StringSelectMenuOptionBuilder().setLabel('Logging').setValue('logging').setDescription('View logging settings'),
      new StringSelectMenuOptionBuilder().setLabel('Honeypot').setValue('honeypot').setDescription('View honeypot settings'),
      new StringSelectMenuOptionBuilder().setLabel('Welcome & Role restoration').setValue('welcome_role').setDescription('Welcome, Goodbye, and Role Restore'),
      new StringSelectMenuOptionBuilder().setLabel('Others').setValue('auto_moderation').setDescription('Auto Embed and Invite Block'),
    );
  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

function buildPermissionsRows(includeBack?: boolean) {
  const toggleModCommands = new ButtonBuilder()
    .setCustomId('toggle_moderator_commands')
    .setLabel('Toggle Mod Commands')
    .setStyle(ButtonStyle.Primary);
  
  const rows: any[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(toggleModCommands)];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
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

function buildWelcomeRoleRows(includeBack?: boolean) {
  // Buttons to toggle welcome/role features
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

function buildAutoModerationRows(includeBack?: boolean) {
  // Buttons to toggle auto moderation features
  const toggleAutoEmbed = new ButtonBuilder().setCustomId('toggle_auto_embed').setLabel('Toggle Auto Embed').setStyle(ButtonStyle.Secondary);
  const toggleInviteBlock = new ButtonBuilder().setCustomId('toggle_invite_block').setLabel('Toggle Invite Block').setStyle(ButtonStyle.Secondary);
  const rows: any[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggleAutoEmbed, toggleInviteBlock),
  ];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}
