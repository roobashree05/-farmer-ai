import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
  userId?: string;
  ip?: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();
