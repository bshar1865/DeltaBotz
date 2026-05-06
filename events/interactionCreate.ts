import { Events, Interaction, StringSelectMenuInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonInteraction, MessageFlags } from "discord.js";
import { logError } from "../utils/errorLogger";
import { ExtendedClient } from "../client";
import configManager from "../utils/ConfigManager";
import idclass from "../utils/idclass";
import { ServerConfig } from "../types/config";
import { getAutoEmbedSwitchState, setAutoEmbedSwitchState } from "../utils/autoEmbedSwitchState";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, client: ExtendedClient) {
    try {
      // Do not drop interactions based on local timing; let Discord handle expiration.
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
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
          }
        }
      } else if (interaction.isStringSelectMenu()) {
        // Handle setup menu selections
        if (interaction.customId === 'setup_menu') {
          // Admin-only guard
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: MessageFlags.Ephemeral }).catch(() => {});
            return;
          }
          await handleSetupMenu(interaction as StringSelectMenuInteraction);
        }
        // no duration selection needed (auto-unban fixed at 10s)
      } else if (interaction.isRoleSelectMenu()) {
        if (interaction.customId === 'setup_role_mods') {
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
            await interaction.followUp({ content: 'Roles updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
          }
        }
      } else if (interaction.isChannelSelectMenu()) {
        const isOwner = (interaction as any).user?.id === idclass.ownershipID();
        if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: 'You need Administrator to use setup.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
            await interaction.followUp({ content: 'Log channel set but failed to update display.', flags: MessageFlags.Ephemeral });
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
            await interaction.followUp({ content: 'Honeypot channel set but failed to update display.', flags: MessageFlags.Ephemeral });
          }
        }
        if (interaction.customId === 'setup_welcome_channel') {
          config.features.welcome = { ...(config.features.welcome || {}), channelId };
          await configManager.saveServerConfig(config);
          const embed = buildWelcomeEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildWelcomeRows(true) });
          } catch (error) {
            console.error('Failed to update welcome channel:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping welcome channel update response');
              return;
            }
            await interaction.followUp({ content: 'Welcome channel set but failed to update display.', flags: MessageFlags.Ephemeral });
          }
        }
        if (interaction.customId === 'setup_goodbye_channel') {
          config.features.goodbye = { ...(config.features.goodbye || {}), channelId };
          await configManager.saveServerConfig(config);
          const embed = buildGoodbyeEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildGoodbyeRows(true) });
          } catch (error) {
            console.error('Failed to update goodbye channel:', error);
            if ((error as any).code === 10062) {
              console.log('Interaction expired, skipping goodbye channel update response');
              return;
            }
            await interaction.followUp({ content: 'Goodbye channel set but failed to update display.', flags: MessageFlags.Ephemeral });
          }
        }
      }
      else if (interaction.isButton()) {
        if (interaction.customId.startsWith('autoembed_set:')) {
          await handleAutoEmbedSwitch(interaction as ButtonInteraction);
          return;
        }

        const isOwner = (interaction as any).user?.id === idclass.ownershipID();
        if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: 'You need Administrator to use setup.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
          const embed = buildWelcomeEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildWelcomeRows(true) });
          } catch (error) {
            console.error('Failed to update welcome toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
          }
          return;
        }
        if (interaction.customId === 'toggle_goodbye') {
          config.features.goodbye = { ...(config.features.goodbye || {}), enabled: !config.features?.goodbye?.enabled };
          await configManager.saveServerConfig(config);
          const embed = buildGoodbyeEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildGoodbyeRows(true) });
          } catch (error) {
            console.error('Failed to update goodbye toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
          }
          return;
        }
        if (interaction.customId === 'toggle_restore') {
          config.features.roleRestore = { ...(config.features.roleRestore || {}), enabled: !config.features?.roleRestore?.enabled };
          await configManager.saveServerConfig(config);
          const embed = buildRoleRestoreEmbed(config);
          try {
            await interaction.update({ embeds: [embed], components: buildRoleRestoreRows(true) });
          } catch (error) {
            console.error('Failed to update restore toggle:', error);
            if ((error as any).code === 10062) return;
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
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
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
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
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
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
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
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
            await interaction.followUp({ content: 'Settings updated but failed to refresh display.', flags: MessageFlags.Ephemeral });
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
            await interaction.followUp({ content: 'Prefix reset but failed to update display. Please refresh.', flags: MessageFlags.Ephemeral });
          }
          return;
        }
        if (interaction.customId === 'reset_welcome_embed') {
          config.features.welcome = { ...(config.features.welcome || {}), embed: undefined };
          await configManager.saveServerConfig(config);
          const embed = buildWelcomeEmbed(config);
          await interaction.update({ embeds: [embed], components: buildWelcomeRows(true) }).catch(() => {});
          return;
        }
        if (interaction.customId === 'reset_goodbye_embed') {
          config.features.goodbye = { ...(config.features.goodbye || {}), embed: undefined };
          await configManager.saveServerConfig(config);
          const embed = buildGoodbyeEmbed(config);
          await interaction.update({ embeds: [embed], components: buildGoodbyeRows(true) }).catch(() => {});
          return;
        }
        if (interaction.customId === 'edit_welcome_embed') {
          const modal = new ModalBuilder().setCustomId('welcome_embed_modal').setTitle('Edit Welcome Embed');
          const current = config.features?.welcome?.embed || {};

          const title = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256)
            .setValue(current.title ?? '');

          const description = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(2000)
            .setValue(current.description ?? '');

          const color = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color hex (optional, e.g. #0099ff)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(7)
            .setValue(current.color ?? '');

          const footer = new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048)
            .setValue(current.footer ?? '');

          const imageUrl = new TextInputBuilder()
            .setCustomId('imageUrl')
            .setLabel('Image URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(4000)
            .setValue(current.imageUrl ?? '');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(title),
            new ActionRowBuilder<TextInputBuilder>().addComponents(description),
            new ActionRowBuilder<TextInputBuilder>().addComponents(color),
            new ActionRowBuilder<TextInputBuilder>().addComponents(footer),
            new ActionRowBuilder<TextInputBuilder>().addComponents(imageUrl),
          );

          await interaction.showModal(modal).catch(() => {});
          return;
        }
        if (interaction.customId === 'edit_goodbye_embed') {
          const modal = new ModalBuilder().setCustomId('goodbye_embed_modal').setTitle('Edit Goodbye Embed');
          const current = config.features?.goodbye?.embed || {};

          const title = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256)
            .setValue(current.title ?? '');

          const description = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(2000)
            .setValue(current.description ?? '');

          const color = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color hex (optional, e.g. #0099ff)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(7)
            .setValue(current.color ?? '');

          const footer = new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048)
            .setValue(current.footer ?? '');

          const imageUrl = new TextInputBuilder()
            .setCustomId('imageUrl')
            .setLabel('Image URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(4000)
            .setValue(current.imageUrl ?? '');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(title),
            new ActionRowBuilder<TextInputBuilder>().addComponents(description),
            new ActionRowBuilder<TextInputBuilder>().addComponents(color),
            new ActionRowBuilder<TextInputBuilder>().addComponents(footer),
            new ActionRowBuilder<TextInputBuilder>().addComponents(imageUrl),
          );

          await interaction.showModal(modal).catch(() => {});
          return;
        }
      } else if (interaction.isModalSubmit()) {
        // Handle modal submissions
        if (interaction.customId === 'prefix_modal') {
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
                flags: MessageFlags.Ephemeral
              });
            } catch (error) {
              console.error('Failed to reply to prefix modal:', error);
              // If reply failed, try followUp only if we already replied
              if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                  content: `Prefix changed to \`${newPrefix}\``,
                  flags: MessageFlags.Ephemeral
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
                flags: MessageFlags.Ephemeral
              });
            } catch (error) {
              console.error('Failed to reply to prefix modal error:', error);
              // If reply failed, try followUp only if we already replied
              if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                  content: 'Invalid prefix. Please use 1-5 characters.',
                  flags: MessageFlags.Ephemeral
                });
              } else {
                // If we can't reply at all, just log the error
                console.error('Cannot respond to modal interaction');
              }
            }
          }
        }

        if (interaction.customId === 'welcome_embed_modal') {
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: MessageFlags.Ephemeral }).catch(() => {});
            return;
          }

          const guild = interaction.guild!;
          const config = await configManager.getOrCreateConfig(guild);

          const title = interaction.fields.getTextInputValue('title').trim();
          const description = interaction.fields.getTextInputValue('description').trim();
          const color = interaction.fields.getTextInputValue('color').trim();
          const footer = interaction.fields.getTextInputValue('footer').trim();
          const imageUrl = interaction.fields.getTextInputValue('imageUrl').trim();

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

          const page = buildWelcomeEmbed(config);
          await interaction.reply({ content: 'Welcome embed updated.', embeds: [page], components: buildWelcomeRows(true), flags: MessageFlags.Ephemeral }).catch(() => {});
          return;
        }

        if (interaction.customId === 'goodbye_embed_modal') {
          const isOwner = (interaction as any).user?.id === idclass.ownershipID();
          if (!isOwner && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator to use setup.', flags: MessageFlags.Ephemeral }).catch(() => {});
            return;
          }

          const guild = interaction.guild!;
          const config = await configManager.getOrCreateConfig(guild);

          const title = interaction.fields.getTextInputValue('title').trim();
          const description = interaction.fields.getTextInputValue('description').trim();
          const color = interaction.fields.getTextInputValue('color').trim();
          const footer = interaction.fields.getTextInputValue('footer').trim();
          const imageUrl = interaction.fields.getTextInputValue('imageUrl').trim();

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

          const page = buildGoodbyeEmbed(config);
          await interaction.reply({ content: 'Goodbye embed updated.', embeds: [page], components: buildGoodbyeRows(true), flags: MessageFlags.Ephemeral }).catch(() => {});
          return;
        }
      }
    } catch (error) {
      console.error("Error in InteractionCreate:", error);
      try { await logError(error instanceof Error ? error : String(error), 'events/interactionCreate', { userId: (interaction as any).user?.id, guildId: (interaction as any).guildId }, client as any, (interaction as any).guild); } catch {}
    }
  },
};

async function handleAutoEmbedSwitch(interaction: ButtonInteraction) {
  const state = getAutoEmbedSwitchState(interaction.message.id);
  if (!state) {
    await interaction.reply({ content: 'This embed switch expired. Please run it again.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  if (interaction.user.id !== state.authorId) {
    await interaction.reply({ content: 'Only the original sender can switch this embed.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const rawIndex = interaction.customId.split(':')[1];
  const index = Number(rawIndex);
  if (!Number.isFinite(index) || index < 0 || index >= state.candidates.length) {
    await interaction.reply({ content: 'Invalid selection.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const nextUrl = state.candidates[index];

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    state.candidates.slice(0, 5).map((candidate, i) => {
      const host = new URL(candidate).hostname.replace(/^www\./i, "");
      return new ButtonBuilder()
        .setCustomId(`autoembed_set:${i}`)
        .setLabel(host)
        .setStyle(i === index ? ButtonStyle.Primary : ButtonStyle.Secondary);
    })
  );

  const { createdAt: _createdAt, ...rest } = state;
  setAutoEmbedSwitchState(interaction.message.id, { ...rest, currentIndex: index });

  const content = state.template === "plain" ? nextUrl : `[⠀](${nextUrl})`;
  await interaction.update({
    content,
    components: [row],
  }).catch(async () => {
    await interaction.reply({ content: 'Failed to update embed message.', flags: MessageFlags.Ephemeral }).catch(() => {});
  });
}

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
      embed = buildWelcomeEmbed(config);
      rows = buildWelcomeRows(true);
      break;
    case 'welcome':
      embed = buildWelcomeEmbed(config);
      rows = buildWelcomeRows(true);
      break;
    case 'goodbye':
      embed = buildGoodbyeEmbed(config);
      rows = buildGoodbyeRows(true);
      break;
    case 'role_restore':
      embed = buildRoleRestoreEmbed(config);
      rows = buildRoleRestoreRows(true);
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
        flags: MessageFlags.Ephemeral 
      });
    } catch (followUpError) {
      console.error('Failed to send follow-up message:', followUpError);
    }
  }
}

function buildBaseEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor('#0099ff')
    .setTimestamp()
    .setFooter({ text: 'Tip: For best experience, set up on Discord for PC; on mobile some buttons may not show.' });
  if (description) embed.setDescription(description);
  return embed;
}

function buildMainEmbed(config: ServerConfig): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(', ') : 'None';
  return buildBaseEmbed(
    'Setup',
    'Use the menu below to configure the bot. Changes save instantly when you select.\n' +
      'Tip: For the best experience, use Discord on PC; some buttons may not show on mobile.\n' +
      'Note: Re-select roles (including previously selected) to ensure they are included.'
  ).addFields(
    { name: 'Prefix', value: `\`${config.prefix || '.'}\``, inline: true },
    { name: 'Mod roles', value: modRolesDisplay, inline: false },
  );
}

function buildPrefixEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseEmbed(
    'Prefix Settings',
    `Current prefix: \`${config.prefix || '.'}\`\n\nUse the button below to change the bot's prefix for this server.`
  );
}

function buildRoleEmbed(config: ServerConfig): EmbedBuilder {
  const modRolesDisplay = config.permissions?.moderatorRoles?.length ? config.permissions.moderatorRoles.map((r: string) => `<@&${r}>`).join(', ') : 'None';
  return buildBaseEmbed(
    'Mod roles',
    `${modRolesDisplay}\n\nNote: Re-select roles (including previously selected) to ensure they are included.`
  );
}

function buildPermissionsEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseEmbed('Mod Commands', 'Enable or disable all moderator commands for this server.').addFields(
    { name: 'Status', value: (config.permissions?.moderatorCommandsEnabled ?? true) ? 'Enabled' : 'Disabled', inline: false },
    { name: 'Note', value: 'When disabled, the bot will completely ignore all mod commands (no response). This applies to everyone, including the server owner.', inline: false },
  );
}

function buildLoggingEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseEmbed('Logging', 'Make sure the bot has access to the selected channel to log.').addFields(
    { name: 'Enabled', value: config.logging?.enabled ? 'Yes' : 'No', inline: true },
    { name: 'Log Channel', value: config.logging?.logChannelId ? `<#${config.logging.logChannelId}>` : 'Not set', inline: true }
  );
}

function buildHoneypotEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseEmbed('Honeypot').addFields(
    { name: 'Enabled', value: config.features?.honeypot?.enabled ? 'Yes' : 'No', inline: true },
    { name: 'Channel', value: config.features?.honeypot?.channelId ? `<#${config.features.honeypot.channelId}>` : 'Not set', inline: true },
    { name: 'Auto Unban', value: config.features?.honeypot?.autoUnban ? 'Yes' : 'No', inline: true },
  );
}

function shorten(input: string, max = 900): string {
  const text = String(input ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function buildWelcomeEmbed(config: ServerConfig): EmbedBuilder {
  const w = config.features?.welcome || { enabled: false };
  const e = w.embed || {};
  return buildBaseEmbed('Welcome', 'Public welcome embed (per-server).').addFields(
    { name: 'Enabled', value: w.enabled ? 'Yes' : 'No', inline: true },
    { name: 'Channel', value: w.channelId ? `<#${w.channelId}>` : 'Not set', inline: true },
    { name: 'Title', value: shorten(e.title || 'Welcome!'), inline: false },
    { name: 'Description', value: shorten(e.description || '{user} joined the server.'), inline: false },
    { name: 'Color', value: e.color ? `\`${e.color}\`` : '`#0099ff`', inline: true },
  );
}

function buildGoodbyeEmbed(config: ServerConfig): EmbedBuilder {
  const g = config.features?.goodbye || { enabled: false };
  const e = g.embed || {};
  return buildBaseEmbed('Goodbye', 'Public leave embed (per-server).').addFields(
    { name: 'Enabled', value: g.enabled ? 'Yes' : 'No', inline: true },
    { name: 'Channel', value: g.channelId ? `<#${g.channelId}>` : 'Not set', inline: true },
    { name: 'Title', value: shorten(e.title || 'Goodbye!'), inline: false },
    { name: 'Description', value: shorten(e.description || '{user} left the server.'), inline: false },
    { name: 'Color', value: e.color ? `\`${e.color}\`` : '`#0099ff`', inline: true },
  );
}

function buildRoleRestoreEmbed(config: ServerConfig): EmbedBuilder {
  return buildBaseEmbed('Role Restore', 'Stores a user’s roles on leave and restores them on rejoin.').addFields(
    { name: 'Enabled', value: config.features?.roleRestore?.enabled ? 'Yes' : 'No', inline: true },
    { name: 'Note', value: 'No roles are announced in welcome/leave messages.', inline: false },
  );
}

function buildAutoModerationEmbed(config: ServerConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Others')
    .setColor('#0099ff')
    .addFields(
      { name: 'Auto Embed', value: config.features?.autoEmbed?.enabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Invite Block', value: config.features?.inviteBlock?.enabled ? 'Enabled' : 'Disabled', inline: true },
    )
    .setFooter({ text: 'Auto Embed converts supported social links to embeddable format. Invite Block deletes Discord invites (mods are exempt).' })
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
      new StringSelectMenuOptionBuilder().setLabel('Welcome').setValue('welcome').setDescription('Welcome embed settings'),
      new StringSelectMenuOptionBuilder().setLabel('Goodbye').setValue('goodbye').setDescription('Leave embed settings'),
      new StringSelectMenuOptionBuilder().setLabel('Role Restore').setValue('role_restore').setDescription('Store roles on leave and restore on join'),
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
  );
  const rows: any[] = [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(honeypotSelect), toggles];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}

function buildWelcomeRows(includeBack?: boolean) {
  const toggle = new ButtonBuilder().setCustomId('toggle_welcome').setLabel('Toggle Welcome').setStyle(ButtonStyle.Secondary);
  const edit = new ButtonBuilder().setCustomId('edit_welcome_embed').setLabel('Edit Embed').setStyle(ButtonStyle.Primary);
  const reset = new ButtonBuilder().setCustomId('reset_welcome_embed').setLabel('Reset Embed').setStyle(ButtonStyle.Secondary);
  const channel = new ChannelSelectMenuBuilder().setCustomId('setup_welcome_channel').setChannelTypes(ChannelType.GuildText).setPlaceholder('Select Welcome channel').setMinValues(0).setMaxValues(1);
  const rows: any[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggle, edit, reset),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channel),
  ];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}

function buildGoodbyeRows(includeBack?: boolean) {
  const toggle = new ButtonBuilder().setCustomId('toggle_goodbye').setLabel('Toggle Goodbye').setStyle(ButtonStyle.Secondary);
  const edit = new ButtonBuilder().setCustomId('edit_goodbye_embed').setLabel('Edit Embed').setStyle(ButtonStyle.Primary);
  const reset = new ButtonBuilder().setCustomId('reset_goodbye_embed').setLabel('Reset Embed').setStyle(ButtonStyle.Secondary);
  const channel = new ChannelSelectMenuBuilder().setCustomId('setup_goodbye_channel').setChannelTypes(ChannelType.GuildText).setPlaceholder('Select Goodbye channel').setMinValues(0).setMaxValues(1);
  const rows: any[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggle, edit, reset),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channel),
  ];
  if (includeBack) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return rows;
}

function buildRoleRestoreRows(includeBack?: boolean) {
  const toggleRestore = new ButtonBuilder().setCustomId('toggle_restore').setLabel('Toggle Role Restore').setStyle(ButtonStyle.Secondary);
  const rows: any[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(toggleRestore)];
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

