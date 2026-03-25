import { Message, Client } from "discord.js";

type EmbedProvider = {
  name: string;
  matchHosts: string[];
  embedHosts: string[];
};

const EMBED_PROVIDERS: EmbedProvider[] = [
  { name: "Twitter/X", matchHosts: ["twitter.com", "x.com"], embedHosts: ["fxtwitter.com"] },
  { name: "Instagram", matchHosts: ["instagram.com"], embedHosts: ["fxstagram.com"] },
  { name: "TikTok", matchHosts: ["tiktok.com"], embedHosts: ["tnktok.com"] },
  { name: "Reddit", matchHosts: ["reddit.com", "redd.it"], embedHosts: ["vxreddit.com"] },
  { name: "Threads", matchHosts: ["threads.net"], embedHosts: ["fixthreads.seria.moe"] },
  { name: "Twitch", matchHosts: ["twitch.tv"], embedHosts: ["fxtwitch.seria.moe"] },
  { name: "Spotify", matchHosts: ["spotify.com"], embedHosts: ["fxspotify.com"] },
  { name: "DeviantArt", matchHosts: ["deviantart.com"], embedHosts: ["fixdeviantart.com"] },
  { name: "YouTube", matchHosts: ["youtube.com", "youtu.be"], embedHosts: ["koutube.com"] }
];

const ALL_EMBED_HOSTS = new Set(EMBED_PROVIDERS.flatMap(p => p.embedHosts));

function normalizeHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

function hostMatches(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`);
}

function findProvider(host: string): EmbedProvider | null {
  for (const provider of EMBED_PROVIDERS) {
    if (provider.matchHosts.some(h => hostMatches(host, h))) return provider;
  }
  return null;
}

function normalizeYouTubeUrl(originalUrl: URL): URL {
  const host = normalizeHost(originalUrl.hostname);
  if (host.endsWith("youtu.be")) {
    const videoId = originalUrl.pathname.replace(/^\/+/, "").split("/")[0];
    if (videoId) {
      const normalized = new URL("https://www.youtube.com/watch");
      normalized.searchParams.set("v", videoId);
      const t = originalUrl.searchParams.get("t");
      if (t) normalized.searchParams.set("t", t);
      return normalized;
    }
  }
  return originalUrl;
}

function buildEmbedUrl(originalUrl: URL, embedHost: string, provider: EmbedProvider): string {
  const baseUrl = provider.name === "YouTube" ? normalizeYouTubeUrl(originalUrl) : originalUrl;
  const next = new URL(baseUrl.toString());
  next.hostname = embedHost;
  return next.toString();
}

/**
 * Checks if a URL is accessible
 */
export async function checkUrlAccessibility(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Gets the best embeddable URL with fallback for supported platforms
 */
export async function getEmbeddableUrl(originalUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return null;
  }

  const host = normalizeHost(parsed.hostname);
  if (ALL_EMBED_HOSTS.has(host)) return null;

  const provider = findProvider(host);
  if (!provider) return null;

  if (provider.embedHosts.length === 1) {
    return buildEmbedUrl(parsed, provider.embedHosts[0], provider);
  }

  for (const embedHost of provider.embedHosts) {
    const candidate = buildEmbedUrl(parsed, embedHost, provider);
    const accessible = await checkUrlAccessibility(candidate);
    if (accessible) return candidate;
  }

  return null;
}

function cleanUrl(input: string): string {
  return input.replace(/^<|>$/g, "").trim();
}

// Command
export default {
  name: "embed",
  description: "Convert supported social links to embeddable format.",

  async execute(message: Message, args: string[], _client: Client) {
    const rawUrl = args[0];

    if (!rawUrl) {
      return message.reply("You need to provide a link to embed.");
    }

    const url = cleanUrl(rawUrl);
    try {
      const embeddableUrl = await getEmbeddableUrl(url);

      if (embeddableUrl) {
        await message.reply({
          content: embeddableUrl,
          allowedMentions: { parse: [] }
        });
      } else {
        await message.reply({
          content: "Unsupported platform or I cannot embed this :(",
          allowedMentions: { parse: [] }
        });
      }
    } catch {
      await message.reply("I cannot embed this :(");
    }
  },
};
