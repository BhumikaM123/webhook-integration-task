import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { SharedModule } from './shared.module';
import { WebhookModule } from './webhook/webhook.module';
import { InvestorModule } from './investor/investor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    SharedModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.getOrThrow<string>('REDIS_URL'));
        const database = redisUrl.pathname.length > 1 ? Number(redisUrl.pathname.slice(1)) : 0;
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
            db: Number.isInteger(database) ? database : 0,
            ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    WebhookModule,
    InvestorModule,
  ],
})
export class AppModule {}
