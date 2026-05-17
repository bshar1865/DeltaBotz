import { EmbedBuilder, GuildMember, Events, HexColorString } from 'discord.js';
import { Event } from '../types';
import { getGuildDB } from '../utils/db';
import configManager from '../utils/ConfigManager';
import { ServerConfig } from '../types/config';
import { sendLogEmbed } from '../utils/logWebhooks';

const event: Event = {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    // Get server configuration
    const config = await configManager.getOrCreateConfig(member.guild);
    
    // Restore roles if enabled
    let restoredRoleIds: string[] = [];
    let failedRoleIds: string[] = [];
    const roleRestoreEnabled = config.features.roleRestore.enabled;

    if (roleRestoreEnabled) {
      const gdb = getGuildDB(member.guild.id);
      const roleIds: string[] | null = await gdb.get(`roles_${member.id}_${member.guild.id}`);
      const me =
        member.guild.members.me ??
        (await member.guild.members.fetchMe().catch(() => null));

      if (roleIds && roleIds.length > 0 && me) {
        for (const roleId of roleIds) {
          const role = member.guild.roles.cache.get(roleId);
          if (role && me.roles.highest.position > role.position) {
            try {
              await member.roles.add(roleId);
              restoredRoleIds.push(roleId);
            } catch (err) {
              console.warn(`Could not restore role ${roleId}:`, err);
              failedRoleIds.push(roleId);
            }
          } else {
            failedRoleIds.push(roleId);
          }
        }
        await gdb.delete(`roles_${member.id}_${member.guild.id}`);
      }
    }

    if (config.features.autoRole.enabled) {
      const me =
        member.guild.members.me ??
        (await member.guild.members.fetchMe().catch(() => null));
      for (const roleId of config.features.autoRole.roleIds) {
        try {
          const role = member.guild.roles.cache.get(roleId);
          if (role && me && me.roles.highest.position > role.position) {
            await member.roles.add(roleId);
          }
        } catch (err) {
          console.warn(`Could not add auto role ${roleId}:`, err);
        }
      }
    }

    // Send welcome message if enabled
    if (config.features.welcome.enabled) {
      const welcomeChannelId = config.features.welcome.channelId || config.channels.welcome;
      const channel = member.guild.channels.cache.get(welcomeChannelId || '');
      
      if (channel?.isTextBased()) {
        const embed = buildMemberEmbed(config, 'welcome', member);
        channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
      }
    }

    // Webhook member join logs (separate from public welcome message)
    if (config.logging?.enabled && config.logging.events?.memberJoin) {
      const fields: { name: string; value: string; inline?: boolean }[] = [
        { name: 'User', value: `${member.user ? `<@${member.user.id}>` : member.id} (${member.id})`, inline: false },
        { name: 'Account', value: member.user ? `${member.user.tag}` : 'Unknown', inline: true },
      ];

      if (roleRestoreEnabled) {
        const restoredShown = restoredRoleIds.slice(0, 50).map(r => `<@&${r}>`).join(', ');
        const failedShown = failedRoleIds.slice(0, 50).map(r => `<@&${r}>`).join(', ');
        const restoredText = restoredShown.length ? restoredShown : 'None';
        const failedText = failedShown.length ? failedShown : 'None';
        fields.push(
          { name: 'Restored Roles', value: restoredText.length > 1024 ? `${restoredText.slice(0, 1021)}...` : restoredText, inline: false },
          { name: 'Failed/Skipped Roles', value: failedText.length > 1024 ? `${failedText.slice(0, 1021)}...` : failedText, inline: false },
        );
      }

      await sendLogEmbed(member.guild, config, 'members', {
        title: 'Member Joined',
        color: 0x57f287,
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

function buildMemberEmbed(config: ServerConfig, kind: 'welcome', member: GuildMember): EmbedBuilder {
  const raw = config.features?.welcome?.embed || {};
  const title = replacePlaceholders(raw.title || 'Welcome!', member);
  const description = replacePlaceholders(raw.description || '{user} joined the server.', member);
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
