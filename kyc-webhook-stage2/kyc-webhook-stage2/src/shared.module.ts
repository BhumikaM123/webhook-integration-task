import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './common/redis.constants';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: REDIS_CLIENT, inject: [ConfigService], useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: null }) },
  ],
  exports: [PrismaService, REDIS_CLIENT],
})
export class SharedModule {}
