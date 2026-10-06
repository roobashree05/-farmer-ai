import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { log } from './common/logger';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  log('info', 'Worker scheduler started');
}

bootstrap();
