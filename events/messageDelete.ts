import { Events, Message, PartialMessage, type APIEmbed } from "discord.js";
import type { Event } from "../types";
import configManager from "../utils/ConfigManager";
import { sendMessageLogEmbed } from "../utils/logWebhooks";
import { deleteMessageHistory, getMessageHistory } from "../utils/messageHistory";

function clip(input: string, max = 1000): string {
  const text = String(input ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function chunk(input: string, max = 1024): string[] {
  const text = String(input ?? "");
  if (!text) return [];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max));
  return out;
}

const event: Event = {
  name: Events.MessageDelete,
  once: false,
  async execute(message: Message | PartialMessage, client: any) {
    if (!message.inGuild()) return;
    if (message.author?.bot) return;

    const guild = message.guild;
    const config = await configManager.getOrCreateConfig(guild);
    if (!config.logging?.enabled) return;
    if (!config.logging.events?.messageDelete) return;

    const history = await getMessageHistory(guild.id, message.id);
    const attachments = Array.from((message as Message).attachments?.values?.() ?? []).map((a) => a.url).length
      ? Array.from((message as Message).attachments?.values?.() ?? []).map((a) => a.url)
      : history?.attachments || [];
    const content = (message as Message).content || history?.content || "";
    const contentChunks = chunk(content, 1024);

    const authorId = message.author?.id || history?.authorId || "unknown";
    const authorTag = message.author?.tag || history?.authorTag || "Unknown";
    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: "Author", value: `<@${authorId}> (${authorId})`, inline: false },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      { name: "Message ID", value: message.id, inline: true },
    ];

    if (contentChunks.length === 0) {
      fields.push({ name: "Content", value: "*No text content*", inline: false });
    } else {
      contentChunks.slice(0, 4).forEach((part, i) => {
        fields.push({ name: i === 0 ? "Content" : `Content (part ${i + 1})`, value: clip(part, 1024), inline: false });
      });
    }

    if (attachments.length) {
      fields.push({ name: "Attachments", value: clip(attachments.join("\n"), 1024), inline: false });
    }

    const embed: APIEmbed = {
      title: "Message Deleted",
      color: 0xff0000,
      fields,
      timestamp: new Date().toISOString(),
    };

    try {
      await sendMessageLogEmbed(guild, config, "messageDelete", embed);
    } catch {
      // ignore
    }

    await deleteMessageHistory(guild.id, message.id);
  },
};

export default event;
