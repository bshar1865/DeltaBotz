type CooldownKey = string;

const cooldowns = new Map<string, number>();

function makeKey(command: CooldownKey, userId: string, guildId?: string): string {
  return `${command}:${guildId ?? 'dm'}:${userId}`;
}

export function getCooldownRemaining(command: CooldownKey, userId: string, guildId?: string): number {
  const key = makeKey(command, userId, guildId);
  const expiresAt = cooldowns.get(key);
  if (!expiresAt) return 0;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    cooldowns.delete(key);
    return 0;
  }
  return remaining;
}

export function setCooldown(command: CooldownKey, userId: string, durationMs: number, guildId?: string): void {
  const key = makeKey(command, userId, guildId);
  cooldowns.set(key, Date.now() + durationMs);
}
