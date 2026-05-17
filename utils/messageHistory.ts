import { Message } from "discord.js";

export interface StoredMessageHistory {
  authorId: string;
  authorTag: string;
  channelId: string;
  content: string;
  attachments: string[];
  expiresAt: number;
}

const historyCache = new Map<string, Map<string, StoredMessageHistory>>();
const MAX_HISTORY_PER_GUILD = 1000;
const MESSAGE_HISTORY_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getGuildCache(guildId: string): Map<string, StoredMessageHistory> {
  let guildCache = historyCache.get(guildId);
  if (!guildCache) {
    guildCache = new Map();
    historyCache.set(guildId, guildCache);
  }
  return guildCache;
}

function pruneGuildCache(guildId: string) {
  const guildCache = historyCache.get(guildId);
  if (!guildCache) return;

  const now = Date.now();
  for (const [messageId, entry] of guildCache.entries()) {
    if (entry.expiresAt <= now) {
      guildCache.delete(messageId);
    }
  }

  if (guildCache.size > MAX_HISTORY_PER_GUILD) {
    const excess = guildCache.size - MAX_HISTORY_PER_GUILD;
    const sorted = [...guildCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    sorted.slice(0, excess).forEach(([id]) => guildCache.delete(id));
  }
}

export async function saveMessageHistory(message: Message): Promise<void> {
  if (!message.inGuild() || message.author?.bot) return;
  const guildCache = getGuildCache(message.guildId);
  const now = Date.now();

  guildCache.set(message.id, {
    authorId: message.author.id,
    authorTag: message.author.tag,
    channelId: message.channel.id,
    content: message.content || "",
    attachments: Array.from(message.attachments.values()).map((attachment) => attachment.url),
    expiresAt: now + MESSAGE_HISTORY_TTL_MS,
  });

  pruneGuildCache(message.guildId);
}

export async function getMessageHistory(guildId: string, messageId: string): Promise<StoredMessageHistory | null> {
  const guildCache = getGuildCache(guildId);
  const entry = guildCache.get(messageId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    guildCache.delete(messageId);
    return null;
  }
  return entry;
}

export async function deleteMessageHistory(guildId: string, messageId: string): Promise<void> {
  getGuildCache(guildId).delete(messageId);
}
