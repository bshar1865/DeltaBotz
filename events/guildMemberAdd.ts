import { GuildMember, Events } from 'discord.js';
import { Event } from '../types';
import { getGuildDB } from '../utils/db';
import configManager from '../utils/ConfigManager';

const event: Event = {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    // Get server configuration
    const config = await configManager.getOrCreateConfig(member.guild);
    
    // Restore roles if enabled
    let restoredRoles: string[] = [];
    if (config.features.roleRestore.enabled) {
      const gdb = getGuildDB(member.guild.id);
      const roleIds: string[] | null = await gdb.get(`roles_${member.id}_${member.guild.id}`);

      if (!member.guild.members.me) return;

      const botHighestRolePosition = member.guild.members.me.roles.highest.position;

      if (roleIds && roleIds.length > 0) {
        for (const roleId of roleIds) {
          const role = member.guild.roles.cache.get(roleId);
          if (role && member.guild.members.me?.roles.highest.position > role.position) {
            try {
              await member.roles.add(roleId);
              restoredRoles.push(roleId);
            } catch (err) {
              console.warn(`Could not restore role ${roleId}:`, err);
            }
          }
        }
        await gdb.delete(`roles_${member.id}_${member.guild.id}`);
      }

      if (config.features.autoRole.enabled) {
        for (const roleId of config.features.autoRole.roleIds) {
          try {
            const role = member.guild.roles.cache.get(roleId);
            if (role && member.guild.members.me?.roles.highest.position > role.position) {
              await member.roles.add(roleId);
              restoredRoles.push(roleId);
            }
          } catch (err) {
            console.warn(`Could not add auto role ${roleId}:`, err);
          }
        }
      }
    }

    // Send welcome message if enabled
    if (config.features.welcome.enabled) {
      const welcomeChannelId = config.features.welcome.channelId || config.channels.welcome;
      const channel = member.guild.channels.cache.get(welcomeChannelId || '');
      
      if (channel?.isTextBased()) {
        const message = config.features.welcome.message || 
          `**${member.displayName}** joined the server \nRestored roles: ${restoredRoles.length ? restoredRoles.map(id => `<@&${id}>`).join(', ') : 'None'}`;
        
        channel.send({
          content: message.replace('{user}', member.toString()).replace('{username}', member.user.username).replace('{displayName}', member.displayName),
          allowedMentions: { parse: [] }
        });
      }
    }

    // Do not log join here; welcome feature handles member joins
  },
};

export default event;
