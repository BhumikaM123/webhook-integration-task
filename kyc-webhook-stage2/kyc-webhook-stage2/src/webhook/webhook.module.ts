import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KYC_QUEUE } from '../common/redis.constants';
import { KycWebhookController } from './kyc-webhook.controller';
import { KycQueueService } from './kyc-queue.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { KycWorker } from './kyc.worker';

@Module({
  imports: [BullModule.registerQueue({ name: KYC_QUEUE })],
  controllers: [KycWebhookController],
  providers: [KycQueueService, WebhookSignatureService, KycWorker],
})
export class WebhookModule {}
