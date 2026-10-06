import { existsSync } from 'fs';
import path from 'path';

export function repoRoot(): string {
  if (existsSync(path.resolve(process.cwd(), 'database/schema.prisma'))) return process.cwd();
  const candidate = path.resolve(process.cwd(), '../..');
  if (existsSync(path.resolve(candidate, 'database/schema.prisma'))) return candidate;
  return process.cwd();
}

export function fromRepo(relativeOrAbsolute: string): string {
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  return path.resolve(repoRoot(), relativeOrAbsolute);
}
