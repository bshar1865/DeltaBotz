import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { Command } from '../types';
import configManager from '../utils/ConfigManager';
import idclass from '../utils/idclass';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the bot with an interactive menu'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', flags: 64 });
      return;
    }

    try {
      const isOwner = interaction.user.id === idclass.ownershipID();
      const hasAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (!isOwner && !hasAdmin) {
        await interaction.reply({ content: 'You need Administrator to use setup.', flags: 64 });
        return;
      }
      const config = await configManager.getOrCreateConfig(interaction.guild);

      const viewMenu = new StringSelectMenuBuilder()
        .setCustomId('setup_menu')
        .setPlaceholder('Select a section to view')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Prefix').setValue('prefix').setDescription('Set custom bot prefix'),
          new StringSelectMenuOptionBuilder().setLabel('Mod roles').setValue('roles').setDescription('View moderator roles'),
          new StringSelectMenuOptionBuilder().setLabel('Mod Commands').setValue('permissions').setDescription('Enable/disable moderator commands'),
          new StringSelectMenuOptionBuilder().setLabel('Logging').setValue('logging').setDescription('View logging settings'),
          new StringSelectMenuOptionBuilder().setLabel('Honeypot').setValue('honeypot').setDescription('View honeypot settings'),
          new StringSelectMenuOptionBuilder().setLabel('Welcome & Role restoration').setValue('welcome_role').setDescription('Welcome, Goodbye, and Role Restore'),
          new StringSelectMenuOptionBuilder().setLabel('Others').setValue('auto_moderation').setDescription('Auto Embed and Invite Block')
        );

      const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(viewMenu);

      const modRolesDisplay = config.permissions.moderatorRoles.length
        ? config.permissions.moderatorRoles.map(r => `<@&${r}>`).join(', ')
        : 'None';

      const embed = new EmbedBuilder()
        .setTitle('Setup')
        .setDescription(
          'Use the menu below to configure the bot. Changes save instantly when you select.\n' +
          'Tip: For the best experience, use Discord on PC; some buttons may not show on mobile.\n' +
          'Note: Re-select roles (including previously selected) to ensure they are included.'
        )
        .addFields(
          { name: 'Prefix', value: `\`${config.prefix}\``, inline: true },
          { name: 'Mod roles', value: modRolesDisplay, inline: false }
        )
        .setColor('#0099ff')
        .setTimestamp()
        .setFooter({ text: 'Use /setup anytime to refresh.' });

      await interaction.reply({ embeds: [embed], components: [row1], flags: 64 });
    } catch (error) {
      console.error('Error in setup command:', error);
      try {
        await interaction.reply({
          content: 'Failed to load server configuration. Please try again later.',
          flags: 64
        });
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }
};

export default command;
