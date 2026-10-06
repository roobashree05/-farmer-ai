export interface FileStorageProvider {
  save(input: { key: string; body: Buffer; contentType: string }): Promise<{ key: string; size: number }>;
  read(key: string): Promise<Buffer>;
}
