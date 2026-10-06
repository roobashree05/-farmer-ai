import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/app.exception';
import { fromRepo } from '../../common/paths';
import type { FileStorageProvider } from './file-storage.provider';

@Injectable()
export class LocalFileStorageProvider implements FileStorageProvider {
  constructor(private readonly config: ConfigService) {}

  private root() {
    return fromRepo(this.config.get<string>('UPLOAD_DIRECTORY') ?? './storage/recordings');
  }

  private resolveKey(key: string) {
    if (key.includes('..') || path.isAbsolute(key)) {
      throw new AppException('INVALID_PATH', 'Invalid storage key', 400);
    }
    const root = path.resolve(this.root());
    const full = path.resolve(root, key);
    if (!full.startsWith(root)) {
      throw new AppException('INVALID_PATH', 'Invalid storage key', 400);
    }
    return full;
  }

  async save(input: { key: string; body: Buffer; contentType: string }) {
    const full = this.resolveKey(input.key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
    return { key: input.key, size: input.body.length };
  }

  async read(key: string) {
    return readFile(this.resolveKey(key));
  }
}
