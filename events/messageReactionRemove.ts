import {
  Events,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  type APIEmbed,
} from "discord.js";
import type { Event } from "../types";
import configManager from "../utils/ConfigManager";
import { sendMessageLogEmbed } from "../utils/logWebhooks";

function clip(input: string, max = 1000): string {
  const text = String(input ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

async function safeFetchReaction(reaction: MessageReaction | PartialMessageReaction): Promise<MessageReaction | PartialMessageReaction> {
  try {
    if (reaction.partial) return await reaction.fetch();
  } catch {}
  return reaction;
}

const event: Event = {
  name: Events.MessageReactionRemove,
  once: false,
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, client: any) {
    const r = await safeFetchReaction(reaction);
    const message = r.message;
    if (!message.inGuild()) return;
    if (user?.bot) return;

    const guild = message.guild!;
    const config = await configManager.getOrCreateConfig(guild);
    if (!config.logging?.enabled) return;
    if (!config.logging.events?.reactionRemove) return;

    const emoji = r.emoji?.toString?.() || (r.emoji?.name ?? "Unknown");
    const jump = (message as any).url ? `Jump link: ${(message as any).url}` : undefined;

    const embed: APIEmbed = {
      title: "Reaction Removed",
      description: jump,
      color: 0x00008b,
      fields: [
        { name: "User", value: `<@${user.id}> (${user.id})`, inline: false },
        { name: "Channel", value: `<#${message.channelId}>`, inline: true },
        { name: "Message ID", value: message.id, inline: true },
        { name: "Emoji", value: clip(emoji, 1024), inline: true },
        { name: "Message Author", value: message.author ? `<@${message.author.id}> (${message.author.id})` : "Unknown", inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    try {
      await sendMessageLogEmbed(guild, config, "reactionRemove", embed);
    } catch {
      // ignore
    }
  },
};

export default event;
