import {
  ChannelType,
  Guild,
  Message,
  NewsChannel,
  PermissionFlagsBits,
  TextChannel,
  type GuildTextBasedChannel,
} from 'discord.js';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BULK_CHUNK = 100;
const FETCH_PAUSE_MS = 350;
const DELETE_PAUSE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBulkDeletable(msg: Message): boolean {
  return !msg.pinned && Date.now() - msg.createdTimestamp < FOURTEEN_DAYS_MS;
}

async function deleteMessageBatch(
  channel: GuildTextBasedChannel,
  messages: Message[]
): Promise<number> {
  if (messages.length === 0) return 0;

  const bulkable = messages.filter(isBulkDeletable);
  let deleted = 0;

  for (let i = 0; i < bulkable.length; i += BULK_CHUNK) {
    const chunk = bulkable.slice(i, i + BULK_CHUNK);
    try {
      // bulkDelete accepts IDs or a Collection; pass IDs to avoid type/runtime issues
      const result = await channel.bulkDelete(chunk.map((m) => m.id), false);
      deleted += result?.size ?? (typeof result === 'number' ? result : 0);
    } catch {
      for (const msg of chunk) {
        try {
          await msg.delete();
          deleted++;
          await sleep(75);
        } catch {
          // Already deleted, too old, or missing permissions
        }
      }
    }
    if (i + BULK_CHUNK < bulkable.length) await sleep(DELETE_PAUSE_MS);
  }

  const nonBulkable = messages.filter((m) => !isBulkDeletable(m) && !m.pinned);
  for (const msg of nonBulkable) {
    try {
      await msg.delete();
      deleted++;
      await sleep(75);
    } catch {
      // Skip inaccessible messages
    }
  }

  return deleted;
}

async function collectMessages(
  channel: GuildTextBasedChannel,
  options: {
    maxMessages: number;
    predicate: (msg: Message) => boolean;
    maxAgeMs?: number;
  }
): Promise<Message[]> {
  const matches: Message[] = [];
  let before: string | undefined;
  let pages = 0;
  const maxPages = Math.ceil(options.maxMessages / 100) + 5;

  while (matches.length < options.maxMessages && pages < maxPages) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;

    const messages = [...batch.values()];
    pages++;

    for (const msg of messages) {
      if (options.maxAgeMs && Date.now() - msg.createdTimestamp > options.maxAgeMs) {
        continue;
      }
      if (options.predicate(msg)) {
        matches.push(msg);
        if (matches.length >= options.maxMessages) return matches;
      }
    }

    const oldest = messages[messages.length - 1];
    if (!oldest || batch.size < 100) break;
    if (options.maxAgeMs && Date.now() - oldest.createdTimestamp > options.maxAgeMs) break;

    before = oldest.id;
    await sleep(FETCH_PAUSE_MS);
  }

  return matches;
}

type ThreadParentChannel = TextChannel | NewsChannel;

async function getTextChannels(guild: Guild): Promise<ThreadParentChannel[]> {
  const channels: ThreadParentChannel[] = [];

  const fetched = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const channel of fetched.values()) {
    if (channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement) {
      channels.push(channel as ThreadParentChannel);
    }
  }

  return channels;
}

async function getThreadChannels(parent: ThreadParentChannel): Promise<GuildTextBasedChannel[]> {
  const threads: GuildTextBasedChannel[] = [];
  const active = await parent.threads.fetchActive().catch(() => null);
  if (active) {
    for (const thread of active.threads.values()) {
      threads.push(thread);
    }
  }
  const archived = await parent.threads.fetchArchived({ limit: 25 }).catch(() => null);
  if (archived) {
    for (const thread of archived.threads.values()) {
      threads.push(thread);
    }
  }
  return threads;
}

/**
 * Purge up to `amount` recent messages in a channel (skips pinned; falls back to single deletes).
 */
export async function purgeRecentMessages(
  channel: GuildTextBasedChannel,
  amount: number
): Promise<number> {
  const extraBuffer = Math.min(50, amount);
  const candidates = await collectMessages(channel, {
    maxMessages: amount + extraBuffer,
    predicate: () => true,
  });

  const targets = candidates.slice(0, amount);
  return deleteMessageBatch(channel, targets);
}

/**
 * Deletes messages from a user across the guild within the last 24 hours.
 */
export async function deleteUserMessagesLastDay(guild: Guild, userId: string): Promise<number> {
  let totalDeleted = 0;
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) return 0;

  const textChannels = await getTextChannels(guild);

  for (const channel of textChannels) {
    // Need ManageMessages plus ViewChannel and ReadMessageHistory to fetch and delete messages
    if (!me.permissionsIn(channel).has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) continue;

    const channelsToScan: GuildTextBasedChannel[] = [channel, ...(await getThreadChannels(channel))];

    for (const targetChannel of channelsToScan) {
      if (!me.permissionsIn(targetChannel).has(PermissionFlagsBits.ManageMessages)) continue;

      try {
        const messages = await collectMessages(targetChannel, {
          maxMessages: 2500,
          maxAgeMs: ONE_DAY_MS,
          predicate: (msg) => msg.author.id === userId,
        });

        totalDeleted += await deleteMessageBatch(targetChannel, messages);
      } catch (error) {
        console.error(`Error deleting messages in channel ${targetChannel.id}:`, error);
      }
    }
  }

  return totalDeleted;
}
