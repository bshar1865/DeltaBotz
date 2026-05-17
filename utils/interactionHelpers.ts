import {
  Interaction,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  MessageFlags,
} from "discord.js";

export async function safeReply(interaction: Interaction, payload: string | InteractionReplyOptions) {
  const replyData = typeof payload === "string" ? { content: payload } : payload;
  if (!interaction.isRepliable?.()) return;
  await interaction.reply({ ...replyData, flags: MessageFlags.Ephemeral }).catch(() => {});
}

export async function safeReplyOrFollowUp(interaction: Interaction, payload: string | InteractionReplyOptions) {
  const replyData = typeof payload === "string" ? { content: payload } : payload;
  if (!interaction.isRepliable?.()) return;
  try {
    await interaction.reply({ ...replyData, flags: MessageFlags.Ephemeral });
  } catch {
    await interaction.followUp({ ...replyData, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

export async function safeUpdate(
  interaction: Interaction,
  payload: InteractionUpdateOptions,
  fallbackMessage?: string,
) {
  if (!("update" in interaction)) return;
  try {
    await (interaction as any).update(payload);
  } catch (error: any) {
    if (error?.code === 10062) return;
    if (fallbackMessage && interaction.isRepliable?.()) {
      await interaction.followUp({ content: fallbackMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}
