import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { getEmbeddableOptions, getEmbeddableUrl } from "../prefix-commands/General/embed";
import { setAutoEmbedSwitchState } from "../utils/autoEmbedSwitchState";

function cleanUrl(input: string): string {
  return input.replace(/^<|>$/g, "").trim();
}

export default {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Convert supported social links to embeddable format.")
    .addStringOption((opt) =>
      opt.setName("link").setDescription("The link to convert.").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const raw = interaction.options.getString("link", true);
    const url = cleanUrl(raw);

    const options = getEmbeddableOptions(url);
    if (!options) {
      await interaction.reply({
        content: "Unsupported platform or I cannot embed this :(",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const candidates = options.candidates;
    const preferred = await getEmbeddableUrl(url);
    const initialUrl = preferred ?? candidates[0];
    const initialIndex = Math.max(0, candidates.indexOf(initialUrl));

    const buttons =
      candidates.length > 1
        ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            candidates.slice(0, 5).map((candidate, i) => {
              const host = new URL(candidate).hostname.replace(/^www\./i, "");
              return new ButtonBuilder()
                .setCustomId(`autoembed_set:${i}`)
                .setLabel(host)
                .setStyle(i === initialIndex ? ButtonStyle.Primary : ButtonStyle.Secondary);
            })
          )
        : undefined;

    await interaction.editReply({
      content: `[⠀](${initialUrl})`,
      components: buttons ? [buttons] : [],
      allowedMentions: { parse: [] },
    });

    if (candidates.length > 1) {
      const replyMessage = await interaction.fetchReply();
      setAutoEmbedSwitchState(replyMessage.id, {
        authorId: interaction.user.id,
        provider: options.provider,
        candidates,
        currentIndex: initialIndex,
        template: "plain",
      });
    }
  },
};
