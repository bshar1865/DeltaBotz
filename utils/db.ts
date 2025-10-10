import { QuickDB } from 'quick.db';
import fs from 'fs';
import path from 'path';

// Global default DB (legacy/shared)
export const db = new QuickDB();

// Cache per-guild DB instances to avoid reopening files
const guildIdToDb = new Map<string, QuickDB>();

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getGuildDB(guildId: string): QuickDB {
  let instance = guildIdToDb.get(guildId);
  if (instance) return instance;

  const guildDir = path.join(__dirname, '..', 'configs', guildId);
  ensureDir(guildDir);
  const filePath = path.join(guildDir, 'json.sqlite');

  const scoped = new QuickDB({ filePath });
  guildIdToDb.set(guildId, scoped);
  return scoped;
}

export default db;
