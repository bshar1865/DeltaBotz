import fs from 'fs';
import path from 'path';

export function getAllFiles(dir: string, ext = '.ts'): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) results = results.concat(getAllFiles(fullPath, ext));
    else if (item.isFile() && item.name.endsWith(ext)) results.push(fullPath);
  }
  return results;
}
