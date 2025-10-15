import fs from 'fs';
import path from 'path';
import { Guild } from 'discord.js';
import db, { getGuildDB } from './db';
import { 
  ServerConfig, 
  ConfigValidationResult, 
  DEFAULT_CONFIG 
} from '../types/config';

export class ConfigManager {
  private configsPath: string;

  constructor() {
    this.configsPath = path.join(__dirname, '..', 'configs');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.configsPath)) {
      fs.mkdirSync(this.configsPath, { recursive: true });
    }
  }

  /**
   * Get server configuration
   */
  async getServerConfig(guildId: string): Promise<ServerConfig | null> {
    try {
      // First try to get from database
      const dbConfig = await getGuildDB(guildId).get(`config_${guildId}`);
      if (dbConfig) {
        return this.validateAndFixConfig(dbConfig as ServerConfig);
      }

      // If not in database, try to load from file
      const configPath = path.join(this.configsPath, guildId, 'config.json');
      if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const validatedConfig = this.validateAndFixConfig(fileConfig);
        // Save to database for faster access
        await this.saveServerConfig(validatedConfig);
        return validatedConfig;
      }

      return null;
    } catch (error) {
      console.error(`Error loading config for guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Create or update server configuration
   */
  async saveServerConfig(config: ServerConfig): Promise<boolean> {
    try {
      const validatedConfig = this.validateAndFixConfig(config);
      validatedConfig.updatedAt = new Date().toISOString();

      // Save to database
      await getGuildDB(config.guildId).set(`config_${config.guildId}`, validatedConfig);

      // Save to file as backup
      const serverDir = path.join(this.configsPath, config.guildId);
      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }
      
      const configPath = path.join(serverDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(validatedConfig, null, 2));

      return true;
    } catch (error) {
      console.error(`Error saving config for guild ${config.guildId}:`, error);
      return false;
    }
  }

  /**
   * Create default configuration for a new server
   */
  async createDefaultConfig(guild: Guild): Promise<ServerConfig> {
    const defaultConfig: ServerConfig = {
      guildId: guild.id,
      guildName: guild.name,
      prefix: '.',
      logging: {
        enabled: true,
        events: {
          messageDelete: true,
          messageEdit: true,
          memberJoin: true,
          memberLeave: true,
          memberUpdate: true,
          roleCreate: true,
          roleDelete: true,
          roleUpdate: true,
          channelCreate: true,
          channelDelete: true,
          channelUpdate: true,
          banAdd: true,
          banRemove: true,
          kick: true,
          warn: true,
          mute: true,
          unmute: true,
        },
      },
      permissions: {
        ownerId: guild.ownerId || '',
        moderatorRoles: [],
        commandPermissions: {},
      },
      moderation: {
        autoModeration: {
          enabled: false,
          spamProtection: false,
          linkFilter: false,
          profanityFilter: false,
          capsFilter: false,
          mentionSpam: false,
        },
        punishment: {
          warnThreshold: 3,
          muteDuration: 600000,
          banThreshold: 5,
          autoDeleteMessages: true,
          deleteMessageDays: 1,
        },
      },
      features: {
        welcome: {
          enabled: false,
        },
        goodbye: {
          enabled: false,
        },
        roleRestore: {
          enabled: false,
        },
        autoRole: {
          enabled: false,
          roleIds: [],
        },
        honeypot: {
          enabled: false,
          deleteMessage: true,
          autoBan: true,
          autoUnban: false,
        },
      },
      channels: {},
      roles: {
        custom: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveServerConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Get or create server configuration
   */
  async getOrCreateConfig(guild: Guild): Promise<ServerConfig> {
    let config = await this.getServerConfig(guild.id);
    if (!config) {
      config = await this.createDefaultConfig(guild);
    }
    return config;
  }

  /**
   * Update specific configuration section
   */
  async updateConfigSection(
    guildId: string, 
    section: keyof ServerConfig, 
    data: any
  ): Promise<boolean> {
    try {
      const config = await this.getServerConfig(guildId);
      if (!config) return false;
      const current = (config as any)[section];
      if (current && typeof current === 'object' && data && typeof data === 'object') {
        (config as any)[section] = { ...current, ...data };
      } else {
        (config as any)[section] = data;
      }
      return await this.saveServerConfig(config);
    } catch (error) {
      console.error(`Error updating config section ${section} for guild ${guildId}:`, error);
      return false;
    }
  }

  /**
   * Update a nested section by path, merging only at the final segment.
   * Example: ["features","honeypot"] with partial honeypot data.
   */
  async updateNestedSection(
    guildId: string,
    sectionPath: (keyof ServerConfig | string)[],
    data: any
  ): Promise<boolean> {
    try {
      const config = await this.getServerConfig(guildId);
      if (!config) return false;
      let ref: any = config;
      for (let i = 0; i < sectionPath.length - 1; i++) {
        const key = sectionPath[i] as string;
        if (!ref[key] || typeof ref[key] !== 'object') ref[key] = {};
        ref = ref[key];
      }
      const lastKey = sectionPath[sectionPath.length - 1] as string;
      const current = ref[lastKey];
      if (current && typeof current === 'object' && data && typeof data === 'object') {
        ref[lastKey] = { ...current, ...data };
      } else {
        ref[lastKey] = data;
      }
      return await this.saveServerConfig(config);
    } catch (error) {
      console.error(`Error updating nested section ${sectionPath.join('.') } for guild ${guildId}:`, error);
      return false;
    }
  }

  /**
   * Delete server configuration
   */
  async deleteServerConfig(guildId: string): Promise<boolean> {
    try {
      // Remove from database
      await getGuildDB(guildId).delete(`config_${guildId}`);

      // Remove from file system
      const serverDir = path.join(this.configsPath, guildId);
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }

      return true;
    } catch (error) {
      console.error(`Error deleting config for guild ${guildId}:`, error);
      return false;
    }
  }

  /**
   * List all server configurations
   */
  async listConfigs(): Promise<ServerConfig[]> {
    try {
      const configs: ServerConfig[] = [];
      const guildDirs = fs.readdirSync(this.configsPath);

      for (const guildId of guildDirs) {
        const config = await this.getServerConfig(guildId);
        if (config) {
          configs.push(config);
        }
      }

      return configs;
    } catch (error) {
      console.error('Error listing configs:', error);
      return [];
    }
  }

  /**
   * Validate and fix configuration
   */
  private validateAndFixConfig(config: any): ServerConfig {
    const validated = { ...DEFAULT_CONFIG, ...config } as ServerConfig;
    
    // Ensure required fields
    if (!validated.guildId) throw new Error('Guild ID is required');
    if (!validated.guildName) validated.guildName = 'Unknown Server';
    if (!validated.prefix) validated.prefix = '?';
    if (!validated.createdAt) validated.createdAt = new Date().toISOString();
    if (!validated.updatedAt) validated.updatedAt = new Date().toISOString();

    // Ensure nested objects exist
    if (!validated.logging) validated.logging = DEFAULT_CONFIG.logging!;
    if (!validated.permissions) validated.permissions = DEFAULT_CONFIG.permissions!;
    if (!validated.moderation) validated.moderation = DEFAULT_CONFIG.moderation!;
    if (!validated.features) validated.features = DEFAULT_CONFIG.features!;
    if (!validated.channels) validated.channels = {};
    if (!validated.roles) validated.roles = { custom: {} };

    return validated;
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ServerConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!config.guildId) errors.push('Guild ID is required');
    if (!config.guildName) errors.push('Guild name is required');
    if (!config.prefix) errors.push('Prefix is required');

    // Validate logging configuration
    if (config.logging.enabled && !config.logging.logChannelId) {
      warnings.push('Logging is enabled but no log channel is set');
    }

    // Validate permissions
    if (!config.permissions.ownerId) {
      warnings.push('No owner ID set - some features may not work');
    }

    // Validate channels exist (basic check)
    if (config.logging.logChannelId && config.logging.logChannelId.length !== 18) {
      errors.push('Invalid log channel ID format');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

}

// Export singleton instance
export const configManager = new ConfigManager();
export default configManager;
