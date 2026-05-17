import { EmbedBuilder, GuildMember, Events, HexColorString } from 'discord.js';
import { Event } from '../types';
import { getGuildDB } from '../utils/db';
import configManager from '../utils/ConfigManager';
import { ServerConfig } from '../types/config';
import { sendLogEmbed } from '../utils/logWebhooks';

const event: Event = {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember) {
    // Get server configuration
    const config = await configManager.getOrCreateConfig(member.guild);

    const leftRoles = member.roles.cache
      .filter(r => !r.managed && r.id !== member.guild.id)
      .map(r => r.id);
    
    // Store roles for restoration if enabled
    if (config.features.roleRestore.enabled) {
      const gdb = getGuildDB(member.guild.id);
      await gdb.set(`roles_${member.id}_${member.guild.id}`, leftRoles);
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

    // Webhook member leave logs (separate from public goodbye message)
    if (config.logging?.enabled && config.logging.events?.memberLeave) {
      const roleRestoreEnabled = config.features.roleRestore.enabled;
      const fields: { name: string; value: string; inline?: boolean }[] = [
        { name: 'User', value: `${member.user ? `<@${member.user.id}>` : member.id} (${member.id})`, inline: false },
        { name: 'Account', value: member.user ? `${member.user.tag}` : 'Unknown', inline: true },
      ];

      if (roleRestoreEnabled) {
        const rolesShown = leftRoles.slice(0, 50).map(r => `<@&${r}>`).join(', ');
        const rolesText = rolesShown.length ? rolesShown : 'None';
        fields.push({
          name: 'Roles (saved for restore)',
          value: rolesText.length > 1024 ? `${rolesText.slice(0, 1021)}...` : rolesText,
          inline: false,
        });
      }

      await sendLogEmbed(member.guild, config, 'members', {
        title: 'Member Left',
        color: 0xed4245,
        fields,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
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
