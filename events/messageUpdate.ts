import { Events, Message, PartialMessage, type APIEmbed } from "discord.js";
import type { Event } from "../types";
import configManager from "../utils/ConfigManager";
import { sendLogEmbed } from "../utils/logWebhooks";

function clip(input: string, max = 1000): string {
  const text = String(input ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

const event: Event = {
  name: Events.MessageUpdate,
  once: false,
  async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage, client: any) {
    if (!newMessage.inGuild()) return;
    if (newMessage.author?.bot) return;

    const guild = newMessage.guild!;
    const config = await configManager.getOrCreateConfig(guild);
    if (!config.logging?.enabled) return;
    if (!config.logging.events?.messageEdit) return;

    const before = (oldMessage as Message).content ?? "";
    const after = (newMessage as Message).content ?? "";
    if (before === after) return;
    if (!before && !after) return;

    const embed: APIEmbed = {
      title: "Message Edited",
      description: (newMessage as Message).url ? `Jump link: ${(newMessage as Message).url}` : undefined,
      color: 0xff0000,
      fields: [
        {
          name: "Author",
          value: `${newMessage.author ? `<@${newMessage.author.id}>` : "Unknown"} (${newMessage.author?.id ?? "unknown"})`,
          inline: false,
        },
        { name: "Channel", value: `<#${newMessage.channelId}>`, inline: true },
        { name: "Message ID", value: newMessage.id, inline: true },
        { name: "Before", value: before ? clip(before, 1024) : "*No text content*", inline: false },
        { name: "After", value: after ? clip(after, 1024) : "*No text content*", inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    try {
      await sendLogEmbed(guild, config, "messages", embed);
    } catch {
      // ignore
    }
  },
};

export default event;
