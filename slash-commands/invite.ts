import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the bot invite link."),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
      content: "Add our bot to your server! - https://discord.com/oauth2/authorize?client_id=1426212984782590023\n\nYou can forward this to your friends to add this bot!",
      allowedMentions: { parse: [] }
    });
  },
};
