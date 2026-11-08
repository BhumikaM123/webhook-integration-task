import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KYC_QUEUE } from '../common/redis.constants';
import { KycJobData } from '../common/types';

@Injectable()
export class KycQueueService implements OnModuleDestroy {
  constructor(@InjectQueue(KYC_QUEUE) private readonly queue: Queue<KycJobData>) {}

  async enqueue(data: KycJobData): Promise<void> {
    const safeJobId = Buffer.from(data.eventId).toString('base64url');
    await this.queue.add('process-kyc', data, {
      jobId: `kyc-${safeJobId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async onModuleDestroy(): Promise<void> { await this.queue.close(); }
}
