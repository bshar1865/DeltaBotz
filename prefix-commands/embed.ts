import { Message, Client } from "discord.js";

/**
 * Converts Instagram URL to embeddable format using vxinstagram or ddinstagram
 */
export function convertInstagramUrl(url: string): { vxUrl: string; ddUrl: string } {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const vxUrl = cleanUrl.replace(/instagram\.com/g, 'vxinstagram.com');
  const ddUrl = cleanUrl.replace(/instagram\.com/g, 'ddinstagram.com');
  return { vxUrl, ddUrl };
}

/**
 * Checks if a URL is accessible
 */
export async function checkUrlAccessibility(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
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
 * Gets the best embeddable URL with fallback (currently supports Instagram)
 */
export async function getEmbeddableUrl(originalUrl: string): Promise<string | null> {
  // Check if it's an Instagram URL
  if (originalUrl.includes('instagram.com')) {
    const { vxUrl, ddUrl } = convertInstagramUrl(originalUrl);
    
    const vxAccessible = await checkUrlAccessibility(vxUrl);
    if (vxAccessible) {
      return vxUrl;
    }
    
    const ddAccessible = await checkUrlAccessibility(ddUrl);
    if (ddAccessible) {
      return ddUrl;
    }
    
    return null;
  }
  
  // Future: Add other platforms here (Pinterest, etc.)
  // if (originalUrl.includes('pinterest.com')) { ... }
  
  return null;
}

// Command
export default {
  name: "embed",

  async execute(message: Message, args: string[], _client: Client) {
    const url = args[0];

    if (!url) {
      return message.reply("You need to provide a link to embed.");
    }

    // Check for Instagram URLs
    const instagramUrlPattern = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/;
    if (instagramUrlPattern.test(url)) {
      if ("sendTyping" in message.channel && typeof message.channel.sendTyping === "function") {
        await message.channel.sendTyping();
      }

      try {
        const embeddableUrl = await getEmbeddableUrl(url);
        
        if (embeddableUrl) {
          await message.reply({
            content: `[⠀](${embeddableUrl})`,
            allowedMentions: { parse: [] }
          });
        } else {
          await message.reply({
            content: "I cannot embed this :(",
            allowedMentions: { parse: [] }
          });
        }
      } catch (err: any) {
        message.reply("I cannot embed this :(");
      }
      return;
    }

    // Future: Add other platform checks here
    // if (url.includes('pinterest.com')) { ... }

    return message.reply("Unsupported platform. Currently supports: Instagram");
  },
};
