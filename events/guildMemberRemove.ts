import { GuildMember, Events } from 'discord.js';
import { Event } from '../types';
import db, { getGuildDB } from '../utils/db';
import idclass from '../utils/idclass';
import configManager from '../utils/ConfigManager';

const event: Event = {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember) {
    // Get server configuration
    const config = await configManager.getOrCreateConfig(member.guild);
    
    // Store roles for restoration if enabled
    let roleIds: string[] = [];
    if (config.features.roleRestore.enabled) {
      const gdb = getGuildDB(member.guild.id);
      roleIds = member.roles.cache
        .filter(r => !r.managed && r.id !== member.guild.id)
        .map(r => r.id);

      await gdb.set(`roles_${member.id}_${member.guild.id}`, roleIds);
    }

    // Send goodbye message if enabled
    if (config.features.goodbye.enabled) {
      const goodbyeChannelId = config.features.goodbye.channelId || config.channels.goodbye;
      const channel = member.guild.channels.cache.get(goodbyeChannelId || '');
      
      if (channel?.isTextBased()) {
        const message = config.features.goodbye.message || 
          `**${member.displayName}** left the server. \nStored roles: ${roleIds.length ? roleIds.map(id => `<@&${id}>`).join(', ') : 'None'}`;
        
        channel.send({
          content: message.replace('{user}', member.toString()).replace('{username}', member.user.username).replace('{displayName}', member.displayName),
          allowedMentions: { parse: [] }
        });
      }
    }

    // Log member leave if logging is enabled
    if (config.logging.enabled && config.logging.events.memberLeave) {
      const logChannelId = config.logging.memberLogChannelId || config.logging.logChannelId;
      const logChannel = member.guild.channels.cache.get(logChannelId || '');
      
      if (logChannel?.isTextBased()) {
        logChannel.send({
          content: `**${member.displayName}** (${member.user.tag}) left the server.`,
          allowedMentions: { parse: [] }
        });
      }
    }
  },
};

export default event;
