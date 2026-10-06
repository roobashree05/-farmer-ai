import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { ResponseInterceptor } from './common/response.interceptor';
import { log } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set to a string of at least 16 characters');
  }
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: (config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const swagger = new DocumentBuilder()
    .setTitle('AIJewel CRM API')
    .setDescription('Local-first CRM API. Mock providers stand in for WhatsApp, Meta, voice, calendar, and AI.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  const port = Number(config.get('API_PORT') ?? 4000);
  await app.listen(port);
  log('info', 'API listening', { port });
}

bootstrap();
