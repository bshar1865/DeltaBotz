import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from "discord.js";
import configManager from "../utils/ConfigManager";
import { setPendingStickerCopy } from "../utils/pendingStickerCopy";
import { hasModAccess } from "../utils/permissions";

export default {
  data: new SlashCommandBuilder()
    .setName("copys")
    .setDescription("Copy a sticker to this server."),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true
      });
    }

    const member = interaction.member as GuildMember;
    const config = await configManager.getOrCreateConfig(interaction.guild);
    const hasPermission = hasModAccess(
      member,
      interaction.user.id,
      config,
      [PermissionFlagsBits.ManageEmojisAndStickers]
    );

    if (!hasPermission) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true
      });
    }

    setPendingStickerCopy({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      expiresAt: Date.now() + 60_000
    });

    return interaction.reply({
      content: "Send a sticker in this channel within 60 seconds.",
      ephemeral: true
    });
  },
};
