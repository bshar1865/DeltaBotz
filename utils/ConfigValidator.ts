import { Guild, ChannelType, PermissionFlagsBits } from 'discord.js';
import { ServerConfig, ConfigValidationResult } from '../types/config';

export class ConfigValidator {
  /**
   * Validate a server configuration
   */
  static async validateConfig(guild: Guild, config: ServerConfig): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!config.guildId) {
      errors.push('Guild ID is required');
    }

    if (!config.guildName) {
      errors.push('Guild name is required');
    }

    if (!config.prefix || config.prefix.length === 0) {
      errors.push('Prefix is required');
    }

    // Validate logging configuration
    if (config.logging.enabled) {
      if (config.logging.logChannelId) {
        const channel = guild.channels.cache.get(config.logging.logChannelId);
        if (!channel) {
          errors.push('Log channel does not exist');
        } else if (channel.type !== ChannelType.GuildText) {
          errors.push('Log channel must be a text channel');
        } else {
          // Check bot permissions
          const botMember = guild.members.me;
          if (botMember) {
            const permissions = channel.permissionsFor(botMember);
            if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
              warnings.push('Bot lacks permissions in log channel');
            }
          }
        }
      } else {
        warnings.push('Logging is enabled but no log channel is set');
      }

      // Validate other log channels
      const logChannels = [
        { id: config.logging.errorLogChannelId, name: 'Error log' },
        { id: config.logging.moderationLogChannelId, name: 'Moderation log' },
        { id: config.logging.memberLogChannelId, name: 'Member log' },
        { id: config.logging.messageLogChannelId, name: 'Message log' },
        { id: config.logging.voiceLogChannelId, name: 'Voice log' }
      ];

      for (const { id, name } of logChannels) {
        if (id) {
          const channel = guild.channels.cache.get(id);
          if (!channel) {
            warnings.push(`${name} channel does not exist`);
          } else if (channel.type !== ChannelType.GuildText) {
            warnings.push(`${name} channel must be a text channel`);
          }
        }
      }
    }

    // Validate permissions
    if (!config.permissions.ownerId) {
      warnings.push('No owner ID set - some features may not work');
    } else {
      const owner = await guild.members.fetch(config.permissions.ownerId).catch(() => null);
      if (!owner) {
        warnings.push('Owner ID does not correspond to a valid member');
      }
    }

    // Validate roles
    const allRoleIds = [
      ...config.permissions.moderatorRoles,
    ];

    for (const roleId of allRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (!role) {
        warnings.push(`Role ${roleId} does not exist`);
      }
    }

    // Validate channels
    const channelEntries = Object.entries(config.channels);
    for (const [name, channelId] of channelEntries) {
      if (channelId) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
          warnings.push(`Channel ${name} (${channelId}) does not exist`);
        }
      }
    }

    // Validate custom roles
    for (const [name, roleId] of Object.entries(config.roles.custom)) {
      const role = guild.roles.cache.get(roleId);
      if (!role) {
        warnings.push(`Custom role ${name} (${roleId}) does not exist`);
      }
    }

    // Validate honeypot configuration
    if (config.features.honeypot.enabled) {
      if (!config.features.honeypot.channelId) {
        errors.push('Honeypot is enabled but no channel is set');
      } else {
        const channel = guild.channels.cache.get(config.features.honeypot.channelId);
        if (!channel) {
          errors.push('Honeypot channel does not exist');
        } else if (channel.type !== ChannelType.GuildText) {
          errors.push('Honeypot channel must be a text channel');
        }
      }
    }

    // Validate feature configurations
    if (config.features.welcome.enabled) {
      if (config.features.welcome.channelId) {
        const channel = guild.channels.cache.get(config.features.welcome.channelId);
        if (!channel) {
          warnings.push('Welcome channel does not exist');
        } else if (channel.type !== ChannelType.GuildText) {
          warnings.push('Welcome channel must be a text channel');
        }
      }
    }

    if (config.features.goodbye.enabled) {
      if (config.features.goodbye.channelId) {
        const channel = guild.channels.cache.get(config.features.goodbye.channelId);
        if (!channel) {
          warnings.push('Goodbye channel does not exist');
        } else if (channel.type !== ChannelType.GuildText) {
          warnings.push('Goodbye channel must be a text channel');
        }
      }
    }

    if (config.features.autoRole.enabled) {
      for (const roleId of config.features.autoRole.roleIds) {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          warnings.push(`Auto-role ${roleId} does not exist`);
        } else {
          // Check if bot can assign this role
          const botMember = guild.members.me;
          if (botMember && botMember.roles.highest.position <= role.position) {
            warnings.push(`Bot cannot assign role ${role.name} - role is higher than bot's highest role`);
          }
        }
      }
    }

    

    

    // Validate moderation settings
    if (config.moderation.punishment.warnThreshold < 0) {
      errors.push('Warn threshold cannot be negative');
    }
    if (config.moderation.punishment.muteDuration < 0) {
      errors.push('Mute duration cannot be negative');
    }
    if (config.moderation.punishment.banThreshold < 0) {
      errors.push('Ban threshold cannot be negative');
    }
    if (config.moderation.punishment.deleteMessageDays < 0 || config.moderation.punishment.deleteMessageDays > 7) {
      errors.push('Delete message days must be between 0 and 7');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Fix common configuration issues
   */
  static fixConfig(guild: Guild, config: ServerConfig): ServerConfig {
    const fixed = { ...config };

    // Fix basic issues
    if (!fixed.guildId) {
      fixed.guildId = guild.id;
    }
    if (!fixed.guildName) {
      fixed.guildName = guild.name;
    }
    if (!fixed.prefix) {
      fixed.prefix = '?';
    }

    // Fix logging configuration
    if (fixed.logging.enabled && fixed.logging.logChannelId) {
      const channel = guild.channels.cache.get(fixed.logging.logChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        // Find a suitable text channel
        const textChannel = guild.channels.cache.find(
          c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me!)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
        );
        if (textChannel) {
          fixed.logging.logChannelId = textChannel.id;
        } else {
          fixed.logging.enabled = false;
        }
      }
    }

    // Fix role references
    const validRoles = guild.roles.cache;
    fixed.permissions.moderatorRoles = fixed.permissions.moderatorRoles.filter(id => validRoles.has(id));

    // Fix channel references
    const validChannels = guild.channels.cache;
    Object.keys(fixed.channels).forEach(key => {
      const channelId = (fixed.channels as any)[key];
      if (channelId && !validChannels.has(channelId)) {
        (fixed.channels as any)[key] = undefined;
      }
    });

    // Fix custom roles
    Object.keys(fixed.roles.custom).forEach(name => {
      const roleId = fixed.roles.custom[name];
      if (!validRoles.has(roleId)) {
        delete fixed.roles.custom[name];
      }
    });

    // Fix auto roles
    fixed.features.autoRole.roleIds = fixed.features.autoRole.roleIds.filter(id => validRoles.has(id));

    // Fix numeric values
    
    if (fixed.moderation.punishment.warnThreshold < 0) {
      fixed.moderation.punishment.warnThreshold = 3;
    }
    if (fixed.moderation.punishment.muteDuration < 0) {
      fixed.moderation.punishment.muteDuration = 600000;
    }
    if (fixed.moderation.punishment.banThreshold < 0) {
      fixed.moderation.punishment.banThreshold = 5;
    }
    if (fixed.moderation.punishment.deleteMessageDays < 0 || fixed.moderation.punishment.deleteMessageDays > 7) {
      fixed.moderation.punishment.deleteMessageDays = 1;
    }

    return fixed;
  }

  /**
   * Get configuration health score (0-100)
   */
  static getHealthScore(config: ServerConfig): number {
    let score = 100;
    let totalChecks = 0;

    // Basic configuration (20 points)
    totalChecks += 4;
    if (!config.guildId) score -= 5;
    if (!config.guildName) score -= 5;
    if (!config.prefix) score -= 5;
    if (!config.permissions.ownerId) score -= 5;

    // Logging configuration (20 points)
    totalChecks += 2;
    if (config.logging.enabled && !config.logging.logChannelId) score -= 10;
    if (config.logging.enabled && !config.logging.errorLogChannelId) score -= 10;

    // Role configuration (20 points)
    totalChecks += 3;
    if (config.permissions.moderatorRoles.length === 0) score -= 7;

    // Feature configuration (20 points)
    totalChecks += 4;
    if (config.features.welcome.enabled && !config.features.welcome.channelId) score -= 5;
    if (config.features.goodbye.enabled && !config.features.goodbye.channelId) score -= 5;
    if (config.features.autoRole.enabled && config.features.autoRole.roleIds.length === 0) score -= 5;

    // Moderation configuration (20 points)
    totalChecks += 4;
    if (config.features.honeypot.enabled && !config.features.honeypot.channelId) score -= 5;
    if (config.moderation.autoModeration.enabled && !config.moderation.autoModeration.spamProtection) score -= 5;
    if (config.moderation.punishment.warnThreshold <= 0) score -= 5;
    if (config.moderation.punishment.banThreshold <= 0) score -= 5;

    return Math.max(0, Math.min(100, score));
  }
}

export default ConfigValidator;
