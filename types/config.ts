import { PermissionResolvable } from 'discord.js';

export interface ServerConfig {
  guildId: string;
  guildName: string;
  prefix: string;
  logging: LoggingConfig;
  permissions: PermissionConfig;
  moderation: ModerationConfig;
  features: FeatureConfig;
  channels: ChannelConfig;
  roles: RoleConfig;
  createdAt: string;
  updatedAt: string;
}

export interface LoggingConfig {
  enabled: boolean;
  logChannelId?: string;
  errorLogChannelId?: string;
  moderationLogChannelId?: string;
  memberLogChannelId?: string;
  messageLogChannelId?: string;
  voiceLogChannelId?: string;
  events: {
    messageDelete: boolean;
    messageEdit: boolean;
    memberJoin: boolean;
    memberLeave: boolean;
    memberUpdate: boolean;
    roleCreate: boolean;
    roleDelete: boolean;
    roleUpdate: boolean;
    channelCreate: boolean;
    channelDelete: boolean;
    channelUpdate: boolean;
    banAdd: boolean;
    banRemove: boolean;
    kick: boolean;
    warn: boolean;
    mute: boolean;
    unmute: boolean;
  };
}

export interface PermissionConfig {
  ownerId: string;
  moderatorRoles: string[];
  commandPermissions: CommandPermissions;
}

export interface CommandPermissions {
  [commandName: string]: {
    roles: string[];
    permissions: PermissionResolvable[];
    bypassOwner: boolean;
    bypassAdmin: boolean;
  };
}

export interface ModerationConfig {
  autoModeration: {
    enabled: boolean;
    spamProtection: boolean;
    linkFilter: boolean;
    profanityFilter: boolean;
    capsFilter: boolean;
    mentionSpam: boolean;
  };
  punishment: {
    warnThreshold: number;
    muteDuration: number;
    banThreshold: number;
    autoDeleteMessages: boolean;
    deleteMessageDays: number;
  };
}

export interface FeatureConfig {
  welcome: {
    enabled: boolean;
    channelId?: string;
    message?: string;
    roleId?: string;
  };
  goodbye: {
    enabled: boolean;
    channelId?: string;
    message?: string;
  };
  roleRestore: {
    enabled: boolean;
  };
  autoRole: {
    enabled: boolean;
    roleIds: string[];
  };
  leveling: {
    enabled: boolean;
    xpPerMessage: number;
    xpCooldown: number;
    levelUpChannelId?: string;
  };
  economy: {
    enabled: boolean;
    currencyName: string;
    currencySymbol: string;
    dailyAmount: number;
    workAmount: number;
  };
  honeypot: {
    enabled: boolean;
    channelId?: string;
    deleteMessage: boolean;
    autoBan: boolean;
  };
}

export interface ChannelConfig {
  general?: string;
  announcements?: string;
  rules?: string;
  support?: string;
  suggestions?: string;
  music?: string;
  nsfw?: string;
  staff?: string;
  logs?: string;
  errors?: string;
  moderation?: string;
  welcome?: string;
  goodbye?: string;
}

export interface RoleConfig {
  owner?: string;
  admin?: string;
  moderator?: string;
  helper?: string;
  member?: string;
  muted?: string;
  verified?: string;
  vip?: string;
  custom: { [name: string]: string };
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigTemplate {
  name: string;
  description: string;
  config: Partial<ServerConfig>;
}

// Default configuration templates
export const DEFAULT_CONFIG: Partial<ServerConfig> = {
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
    ownerId: '',
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
      muteDuration: 600000, // 10 minutes
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
    leveling: {
      enabled: false,
      xpPerMessage: 10,
      xpCooldown: 60000, // 1 minute
    },
    economy: {
      enabled: false,
      currencyName: 'coins',
      currencySymbol: '🪙',
      dailyAmount: 100,
      workAmount: 50,
    },
    honeypot: {
      enabled: false,
      deleteMessage: true,
      autoBan: true,
    },
  },
  channels: {},
  roles: {
    custom: {},
  },
};
