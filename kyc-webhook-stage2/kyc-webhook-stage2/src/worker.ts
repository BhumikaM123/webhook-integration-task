import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  Logger.log('KYC BullMQ worker is running', 'WorkerBootstrap');
  const shutdown = async (): Promise<void> => { await app.close(); process.exit(0); };
  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

void bootstrapWorker();
