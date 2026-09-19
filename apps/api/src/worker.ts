import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(AppModule);
  new Logger('Worker').log('Worker started. No queues are consumed yet.');
  // Nothing holds the event loop open until BullMQ arrives, so hold it here.
  // No SIGTERM listener is registered, so Docker still stops the container at once.
  setInterval(() => undefined, 1 << 30);
}

void bootstrap();
