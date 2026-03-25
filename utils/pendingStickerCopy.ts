export type PendingStickerCopy = {
  userId: string;
  guildId: string;
  channelId: string;
  expiresAt: number;
};

const pendingStickerCopies = new Map<string, PendingStickerCopy>();

export function setPendingStickerCopy(entry: PendingStickerCopy): void {
  pendingStickerCopies.set(entry.userId, entry);
}

export function getPendingStickerCopy(userId: string): PendingStickerCopy | null {
  const entry = pendingStickerCopies.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pendingStickerCopies.delete(userId);
    return null;
  }
  return entry;
}

export function clearPendingStickerCopy(userId: string): void {
  pendingStickerCopies.delete(userId);
}
