import { requestContext } from './request-context';

type Level = 'info' | 'warn' | 'error';

export function log(level: Level, message: string, extra?: Record<string, unknown>) {
  const store = requestContext.getStore();
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'aijewel-api',
    requestId: store?.requestId,
    userId: store?.userId,
    message,
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
