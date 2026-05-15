import {
  Guild,
  PermissionFlagsBits,
  NewsChannel,
  TextChannel,
  WebhookClient,
  type APIEmbed,
} from "discord.js";
import configManager from "./ConfigManager";
import type { ServerConfig } from "../types/config";
import { logError } from "./errorLogger";

export type LogSection = "moderation" | "members" | "messages";

type WebhookRef = {
  channelId?: string;
  id?: string;
  token?: string;
};

const webhookClients = new Map<string, WebhookClient>();
const sendQueues = new Map<string, Promise<void>>();
const CREATE_COOLDOWN_MS = 10 * 60 * 1000;
const lastCreateAttempt = new Map<string, number>();

function getRef(config: ServerConfig, section: LogSection): WebhookRef {
  const ref = (config.logging.webhooks || {}) as Record<string, WebhookRef>;
  if (!ref[section]) ref[section] = {};
  return ref[section];
}

function getChannelId(config: ServerConfig, section: LogSection): string | undefined {
  const ref = getRef(config, section);
  if (ref.channelId) return ref.channelId;
  const fallback = config.logging.moderationLogChannelId || config.logging.logChannelId;
  if (section === "moderation") return fallback;
  if (section === "members") return config.logging.memberLogChannelId || fallback;
  return config.logging.messageLogChannelId || fallback;
}

function getInheritedWebhookRef(config: ServerConfig, section: LogSection): WebhookRef | null {
  if (section === "moderation") return null;
  const channelId = getChannelId(config, section);
  const modChannelId = getChannelId(config, "moderation");
  if (!channelId || !modChannelId) return null;
  if (channelId !== modChannelId) return null;
  const modRef = getRef(config, "moderation");
  if (modRef.id && modRef.token && modRef.channelId === channelId) return modRef;
  return null;
}

function cacheKey(id: string, token: string): string {
  return `${id}:${token}`;
}

function getClient(id: string, token: string): WebhookClient {
  const key = cacheKey(id, token);
  const cached = webhookClients.get(key);
  if (cached) return cached;
  const client = new WebhookClient({ id, token });
  webhookClients.set(key, client);
  return client;
}

function queueSend(key: string, fn: () => Promise<void>): Promise<void> {
  const prev = sendQueues.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(async () => {
    await fn();
    await new Promise((r) => setTimeout(r, 250));
  });
  sendQueues.set(key, next);
  return next;
}

function shouldSkipCreate(key: string): boolean {
  const last = lastCreateAttempt.get(key) ?? 0;
  const now = Date.now();
  if (now - last < CREATE_COOLDOWN_MS) return true;
  lastCreateAttempt.set(key, now);
  return false;
}

export async function setLogSectionChannel(
  guild: Guild,
  config: ServerConfig,
  section: LogSection,
  channelId: string | undefined
): Promise<{ ok: boolean; message?: string }> {
  const ref = getRef(config, section);
  if (!channelId) {
    ref.channelId = undefined;
    ref.id = undefined;
    ref.token = undefined;
    if (section === "members") config.logging.memberLogChannelId = undefined;
    if (section === "messages") config.logging.messageLogChannelId = undefined;
    if (section === "moderation") {
      config.logging.moderationLogChannelId = undefined;
      config.logging.logChannelId = undefined;
    }
    await configManager.saveServerConfig(config);
    return { ok: true };
  }

  ref.channelId = channelId;
  if (section === "members") config.logging.memberLogChannelId = channelId;
  if (section === "messages") config.logging.messageLogChannelId = channelId;
  if (section === "moderation") {
    config.logging.moderationLogChannelId = channelId;
    config.logging.logChannelId = channelId;
  }

  ref.id = undefined;
  ref.token = undefined;
  await configManager.saveServerConfig(config);

  const created = await ensureLogWebhook(guild, config, section);
  if (!created) {
    return { ok: true, message: "Channel saved, but I couldn't create a webhook. Please grant me Manage Webhooks in that channel." };
  }
  return { ok: true };
}

export async function ensureLogWebhook(
  guild: Guild,
  config: ServerConfig,
  section: LogSection
): Promise<WebhookRef | null> {
  const channelId = getChannelId(config, section);
  if (!channelId) return null;

  const inherited = getInheritedWebhookRef(config, section);
  if (inherited) return inherited;

  const ref = getRef(config, section);
  if (ref.id && ref.token && ref.channelId === channelId) return ref;

  const cooldownKey = `${guild.id}:${section}:${channelId}`;
  if (shouldSkipCreate(cooldownKey)) return null;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isThread()) return null;
  if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) return null;

  const me = guild.members.me;
  if (!me) return null;
  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.ManageWebhooks) || !perms.has(PermissionFlagsBits.SendMessages)) return null;

  try {
    const name =
      section === "moderation" ? "DeltaBotz • Moderation Logs" :
      section === "members" ? "DeltaBotz • Member Logs" :
      "DeltaBotz • Message Logs";

    const webhook = await channel.createWebhook({ name, reason: `DeltaBotz logging webhook (${section})` });
    ref.channelId = channelId;
    ref.id = webhook.id;
    ref.token = webhook.token ?? undefined;
    config.logging.webhooks = { ...(config.logging.webhooks || {}), [section]: ref };
    await configManager.saveServerConfig(config);
    return ref.token ? ref : null;
  } catch (error) {
    try { await logError(error instanceof Error ? error : String(error), "ensureLogWebhook", { guildId: guild.id, section, channelId }, guild.client, guild); } catch {}
    return null;
  }
}

function isUnknownWebhook(err: any): boolean {
  const code = err?.code as number | undefined;
  return code === 10015 || /Unknown Webhook/i.test(String(err?.message || err));
}

export async function sendLogEmbed(
  guild: Guild,
  config: ServerConfig,
  section: LogSection,
  embed: APIEmbed
): Promise<void> {
  if (!config.logging?.enabled) return;

  const sectionEvents = config.logging.events || ({} as any);
  if (section === "messages" && !(sectionEvents.messageDelete || sectionEvents.messageEdit || sectionEvents.reactionRemove)) {
    return;
  }
  if (section === "members" && !(sectionEvents.memberJoin || sectionEvents.memberLeave)) {
    return;
  }

  const ref = await ensureLogWebhook(guild, config, section);
  if (!ref?.id || !ref.token) return;

  const key = cacheKey(ref.id, ref.token);
  const client = getClient(ref.id, ref.token);
  const botUser = guild.client.user;
  const username = botUser?.username || "DeltaBotz";
  const avatarURL = botUser?.displayAvatarURL({ size: 128 }) || undefined;

  await queueSend(key, async () => {
    try {
      await client.send({
        username,
        avatarURL,
        embeds: [embed],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      if (isUnknownWebhook(error)) {
        const refreshed = await ensureLogWebhook(guild, config, section);
        if (!refreshed?.id || !refreshed.token) return;
        const nextClient = getClient(refreshed.id, refreshed.token);
        await nextClient.send({
          username,
          avatarURL,
          embeds: [embed],
          allowedMentions: { parse: [] },
        }).catch(() => {});
        return;
      }
      try { await logError(error instanceof Error ? error : String(error), "sendLogEmbed", { guildId: guild.id, section }, guild.client, guild); } catch {}
    }
  });
}
