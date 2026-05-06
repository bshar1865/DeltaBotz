import { EmbedBuilder, GuildMember, Events, HexColorString } from 'discord.js';
import { Event } from '../types';
import { getGuildDB } from '../utils/db';
import configManager from '../utils/ConfigManager';
import { ServerConfig } from '../types/config';

const event: Event = {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember) {
    // Get server configuration
    const config = await configManager.getOrCreateConfig(member.guild);
    
    // Store roles for restoration if enabled
    if (config.features.roleRestore.enabled) {
      const gdb = getGuildDB(member.guild.id);
      const roleIds = member.roles.cache
        .filter(r => !r.managed && r.id !== member.guild.id)
        .map(r => r.id);

      await gdb.set(`roles_${member.id}_${member.guild.id}`, roleIds);
    }

    // Send goodbye message if enabled
    if (config.features.goodbye.enabled) {
      const goodbyeChannelId = config.features.goodbye.channelId || config.channels.goodbye;
      const channel = member.guild.channels.cache.get(goodbyeChannelId || '');
      
      if (channel?.isTextBased()) {
        const embed = buildMemberEmbed(config, 'goodbye', member);
        channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
      }
    }

    // Do not log leave here; goodbye feature handles member leaves
  },
};

export default event;

function replacePlaceholders(input: string, member: GuildMember): string {
  return input
    .replace(/\{user\}/g, member.toString())
    .replace(/\{username\}/g, member.user.username)
    .replace(/\{displayName\}/g, member.displayName)
    .replace(/\{server\}/g, member.guild.name);
}

function normalizeHexColor(input: string | undefined): HexColorString | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return (`#${hex.toLowerCase()}` as HexColorString);
}

function buildMemberEmbed(config: ServerConfig, kind: 'goodbye', member: GuildMember): EmbedBuilder {
  const raw = config.features?.goodbye?.embed || {};
  const title = replacePlaceholders(raw.title || 'Goodbye!', member);
  const description = replacePlaceholders(raw.description || '{user} left the server.', member);
  const color = normalizeHexColor(raw.color) || ('#0099ff' as HexColorString);

  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();

  const useThumb = raw.thumbnail ?? true;
  if (useThumb) {
    embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
  }

  if (raw.footer) {
    embed.setFooter({ text: replacePlaceholders(raw.footer, member) });
  }

  if (raw.imageUrl) {
    embed.setImage(replacePlaceholders(raw.imageUrl, member));
  }

  return embed;
}
