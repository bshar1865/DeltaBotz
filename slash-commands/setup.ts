import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';
import { Command } from '../types';
import configManager from '../utils/ConfigManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the bot with an interactive menu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    const config = await configManager.getOrCreateConfig(interaction.guild);

    const viewMenu = new StringSelectMenuBuilder()
      .setCustomId('setup_menu')
      .setPlaceholder('Select a section to view')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Mod roles').setValue('roles').setDescription('View moderator roles'),
        new StringSelectMenuOptionBuilder().setLabel('Logging').setValue('logging').setDescription('View logging settings'),
        new StringSelectMenuOptionBuilder().setLabel('Honeypot').setValue('honeypot').setDescription('View honeypot settings'),
        new StringSelectMenuOptionBuilder().setLabel('Features').setValue('features').setDescription('View feature toggles'),
      );

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(viewMenu);

    const modRolesDisplay = config.permissions.moderatorRoles.length ? config.permissions.moderatorRoles.map(r => `<@&${r}>`).join(', ') : 'None';

    const embed = new EmbedBuilder()
      .setTitle('Setup')
      .setDescription('Use the menus below to configure the bot. Changes save instantly when you select.')
      .addFields(
        { name: 'Prefix', value: config.prefix, inline: true },
        { name: 'Logging', value: config.logging.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Honeypot', value: config.features.honeypot.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Mod roles', value: modRolesDisplay, inline: false },
      )
      .setColor('#0099ff')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
  },
};

async function handleLoggingSetup(interaction: ChatInputCommandInteraction) {
  const logChannel = interaction.options.getChannel('log_channel');
  const errorChannel = interaction.options.getChannel('error_channel');
  const moderationChannel = interaction.options.getChannel('moderation_channel');

  const config = await configManager.getOrCreateConfig(interaction.guild!);
  
  if (logChannel) {
    config.logging.logChannelId = logChannel.id;
  }
  if (errorChannel) {
    config.logging.errorLogChannelId = errorChannel.id;
  }
  if (moderationChannel) {
    config.logging.moderationLogChannelId = moderationChannel.id;
  }

  const success = await configManager.saveServerConfig(config);
  
  if (success) {
    const embed = new EmbedBuilder()
      .setTitle('Logging Setup Complete')
      .setColor('#00ff00')
      .addFields(
        { name: 'Log Channel', value: logChannel ? `<#${logChannel.id}>` : 'Not set', inline: true },
        { name: 'Error Channel', value: errorChannel ? `<#${errorChannel.id}>` : 'Not set', inline: true },
        { name: 'Moderation Channel', value: moderationChannel ? `<#${moderationChannel.id}>` : 'Not set', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({ content: 'Failed to update logging configuration.', ephemeral: true });
  }
}

async function handleRolesSetup(interaction: ChatInputCommandInteraction) {
  const moderatorRole = interaction.options.getRole('moderator_role');

  const config = await configManager.getOrCreateConfig(interaction.guild!);
  
  if (moderatorRole) {
    if (!config.permissions.moderatorRoles.includes(moderatorRole.id)) {
      config.permissions.moderatorRoles.push(moderatorRole.id);
    }
  }

  const success = await configManager.saveServerConfig(config);
  
  if (success) {
    const embed = new EmbedBuilder()
      .setTitle('Role Setup Complete')
      .setColor('#00ff00')
      .addFields(
        { name: 'Moderator Roles', value: config.permissions.moderatorRoles.length.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({ content: 'Failed to update role configuration.', ephemeral: true });
  }
}

async function handleModerationSetup(interaction: ChatInputCommandInteraction) {
  const autoModeration = interaction.options.getBoolean('auto_moderation');
  const spamProtection = interaction.options.getBoolean('spam_protection');
  const linkFilter = interaction.options.getBoolean('link_filter');
  const profanityFilter = interaction.options.getBoolean('profanity_filter');

  const config = await configManager.getOrCreateConfig(interaction.guild!);
  
  if (autoModeration !== null) {
    config.moderation.autoModeration.enabled = autoModeration;
  }
  if (spamProtection !== null) {
    config.moderation.autoModeration.spamProtection = spamProtection;
  }
  if (linkFilter !== null) {
    config.moderation.autoModeration.linkFilter = linkFilter;
  }
  if (profanityFilter !== null) {
    config.moderation.autoModeration.profanityFilter = profanityFilter;
  }

  const success = await configManager.saveServerConfig(config);
  
  if (success) {
    const embed = new EmbedBuilder()
      .setTitle('Moderation Setup Complete')
      .setColor('#00ff00')
      .addFields(
        { name: 'Auto Moderation', value: config.moderation.autoModeration.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Spam Protection', value: config.moderation.autoModeration.spamProtection ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Link Filter', value: config.moderation.autoModeration.linkFilter ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Profanity Filter', value: config.moderation.autoModeration.profanityFilter ? 'Enabled' : 'Disabled', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({ content: 'Failed to update moderation configuration.', ephemeral: true });
  }
}

async function handleFeaturesSetup(interaction: ChatInputCommandInteraction) {
  const welcome = interaction.options.getBoolean('welcome');
  const goodbye = interaction.options.getBoolean('goodbye');
  const leveling = interaction.options.getBoolean('leveling');
  const economy = interaction.options.getBoolean('economy');

  const config = await configManager.getOrCreateConfig(interaction.guild!);
  
  if (welcome !== null) {
    config.features.welcome.enabled = welcome;
  }
  if (goodbye !== null) {
    config.features.goodbye.enabled = goodbye;
  }
  if (leveling !== null) {
    config.features.leveling.enabled = leveling;
  }
  if (economy !== null) {
    config.features.economy.enabled = economy;
  }

  const success = await configManager.saveServerConfig(config);
  
  if (success) {
    const embed = new EmbedBuilder()
      .setTitle('Features Setup Complete')
      .setColor('#00ff00')
      .addFields(
        { name: 'Welcome Messages', value: config.features.welcome.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Goodbye Messages', value: config.features.goodbye.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Leveling System', value: config.features.leveling.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Economy System', value: config.features.economy.enabled ? 'Enabled' : 'Disabled', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({ content: 'Failed to update features configuration.', ephemeral: true });
  }
}

async function handleHoneypotSetup(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true);
  const autoBan = interaction.options.getBoolean('auto_ban');
  const deleteMessages = interaction.options.getBoolean('delete_messages');

  const config = await configManager.getOrCreateConfig(interaction.guild!);
  
  config.features.honeypot.enabled = true;
  config.features.honeypot.channelId = channel.id;
  
  if (autoBan !== null) {
    config.features.honeypot.autoBan = autoBan;
  }
  if (deleteMessages !== null) {
    config.features.honeypot.deleteMessage = deleteMessages;
  }

  const success = await configManager.saveServerConfig(config);
  
  if (success) {
    const embed = new EmbedBuilder()
      .setTitle('Honeypot Setup Complete')
      .setColor('#00ff00')
      .addFields(
        { name: 'Honeypot Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Auto Ban', value: config.features.honeypot.autoBan ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Delete Messages', value: config.features.honeypot.deleteMessage ? 'Enabled' : 'Disabled', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({ content: 'Failed to update honeypot configuration.', ephemeral: true });
  }
}

async function handleShowSetup(interaction: ChatInputCommandInteraction) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup_menu')
    .setPlaceholder('Select a section to view')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Mod roles').setValue('roles').setDescription('View moderator roles'),
      new StringSelectMenuOptionBuilder().setLabel('Logging').setValue('logging').setDescription('View logging settings'),
      new StringSelectMenuOptionBuilder().setLabel('Honeypot').setValue('honeypot').setDescription('View honeypot settings'),
      new StringSelectMenuOptionBuilder().setLabel('Features').setValue('features').setDescription('View feature toggles'),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  const embed = new EmbedBuilder()
    .setTitle('Setup')
    .setDescription('Use the menu below to view a section. Make changes using `/setup` subcommands.')
    .setColor('#0099ff')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleCompleteSetup(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('Complete Setup Wizard')
    .setColor('#ff9900')
    .setDescription('This will guide you through setting up your server configuration step by step.')
    .addFields(
      { name: 'Step 1', value: 'Use `/setup logging` to configure logging channels', inline: false },
      { name: 'Step 2', value: 'Use `/setup roles` to set up role permissions', inline: false },
      { name: 'Step 3', value: 'Use `/setup moderation` to configure auto-moderation', inline: false },
      { name: 'Step 4', value: 'Use `/setup features` to enable bot features', inline: false },
      { name: 'Step 5', value: 'Use `/setup honeypot` to set up honeypot channel', inline: false },
      { name: 'Step 6', value: 'Use `/config view` to review your configuration', inline: false }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export default command;
