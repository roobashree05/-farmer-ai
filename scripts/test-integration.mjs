import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://aijewel:aijewel@127.0.0.1:5432/aijewel_test',
  SEED_PASSWORD: 'Local-demo-1234',
  JWT_SECRET: 'test-jwt-secret-123456',
  JWT_REFRESH_SECRET: 'test-refresh-secret-123456',
  DEMO_MODE: 'true',
  SCHEDULER_ENABLED: 'false',
  UPLOAD_DIRECTORY: './storage/test-recordings',
  WHATSAPP_PROVIDER: 'mock',
  META_PROVIDER: 'mock',
  AI_PROVIDER: 'mock',
  VOICE_PROVIDER: 'mock',
  CALENDAR_PROVIDER: 'mock',
  STORAGE_PROVIDER: 'local',
  WEB_ORIGIN: 'http://localhost:3000',
};

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npx', ['tsx', 'scripts/prepare-test-db.ts']);
run('npx', ['jest', '--config', 'jest.integration.json', '--runInBand'], path.join(root, 'apps/api'));
