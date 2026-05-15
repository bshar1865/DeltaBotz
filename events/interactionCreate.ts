import { Events, Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, MessageFlags } from "discord.js";
import { logError } from "../utils/errorLogger";
import { ExtendedClient } from "../client";
import { getAutoEmbedSwitchState, setAutoEmbedSwitchState } from "../utils/autoEmbedSwitchState";
import { handleSetupButton, handleSetupChannelSelect, handleSetupModalSubmit, handleSetupRoleSelect, handleSetupStringSelect } from "../setup/handlers";

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
        if (await handleSetupStringSelect(interaction as any)) return;
      } else if (interaction.isRoleSelectMenu()) {
        if (await handleSetupRoleSelect(interaction as any)) return;
      } else if (interaction.isChannelSelectMenu()) {
        if (await handleSetupChannelSelect(interaction as any)) return;
      }
      else if (interaction.isButton()) {
        if (interaction.customId.startsWith('autoembed_set:')) {
          await handleAutoEmbedSwitch(interaction as ButtonInteraction);
          return;
        }
        if (await handleSetupButton(interaction as any)) return;
      } else if (interaction.isModalSubmit()) {
        if (await handleSetupModalSubmit(interaction as any)) return;
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


