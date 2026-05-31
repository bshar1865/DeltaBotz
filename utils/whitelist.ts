import { ServerConfig } from "../types/config";

export function normalizeUserId(input: string): string | null {
  const match = input.match(/^<@!?(\d+)>$/);
  const id = match ? match[1] : input;
  return /^\d{17,19}$/.test(id) ? id : null;
}

export function parseWhitelistIds(args: string[]): string[] {
  const ids: string[] = [];
  for (const arg of args) {
    const normalized = normalizeUserId(arg.trim());
    if (normalized && !ids.includes(normalized)) {
      ids.push(normalized);
    }
  }
  return ids;
}

export function getWhitelistedUserIds(config: ServerConfig): string[] {
  return config.features?.whitelistEnforcement?.whitelistedUserIds || [];
}

export function isUserWhitelisted(config: ServerConfig, userId: string): boolean {
  return getWhitelistedUserIds(config).includes(userId);
}

export function addWhitelistedUserIds(config: ServerConfig, ids: string[]): number {
  const existing = new Set(getWhitelistedUserIds(config));
  let added = 0;
  for (const id of ids) {
    if (!existing.has(id)) {
      existing.add(id);
      added++;
    }
  }
  const updated = Array.from(existing);
  config.features.whitelistEnforcement = {
    ...(config.features.whitelistEnforcement || { enabled: false, whitelistedUserIds: [] }),
    whitelistedUserIds: updated,
  };
  return added;
}

export function removeWhitelistedUserIds(config: ServerConfig, ids: string[]): number {
  const existing = new Set(getWhitelistedUserIds(config));
  let removed = 0;
  for (const id of ids) {
    if (existing.delete(id)) removed++;
  }
  config.features.whitelistEnforcement = {
    ...(config.features.whitelistEnforcement || { enabled: false, whitelistedUserIds: [] }),
    whitelistedUserIds: Array.from(existing),
  };
  return removed;
}
