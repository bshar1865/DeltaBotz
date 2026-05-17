import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { Command } from '../../types';
import configManager from '../../utils/ConfigManager';
import { buildSetupHomeEmbed, buildSetupMenuRow } from '../../utils/setupUi';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the bot with an interactive menu'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const botOwnerId = process.env.BOT_OWNER_ID || process.env.OWNER_ID || "";
      const isBotOwner = interaction.user.id === botOwnerId;
      const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
      const hasAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (!isBotOwner && !isGuildOwner && !hasAdmin) {
        await interaction.reply({ content: 'You need Administrator or server owner to use setup.', flags: MessageFlags.Ephemeral });
        return;
      }
      const config = await configManager.getOrCreateConfig(interaction.guild);
      const embed = buildSetupHomeEmbed(config).setFooter({ text: 'Use /setup anytime to refresh.' });
      const row1 = buildSetupMenuRow();
      await interaction.reply({ embeds: [embed], components: [row1], flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Error in setup command:', error);
      try {
        await interaction.reply({
          content: 'Failed to load server configuration. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }
};

export default command;
