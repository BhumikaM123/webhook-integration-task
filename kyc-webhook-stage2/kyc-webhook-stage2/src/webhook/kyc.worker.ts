import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { KYC_QUEUE, REDIS_CLIENT } from '../common/redis.constants';
import { KycJobData } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

@Processor(KYC_QUEUE, { concurrency: 5 })
export class KycWorker extends WorkerHost {
  constructor(private readonly prisma: PrismaService, @Inject(REDIS_CLIENT) private readonly redis: Redis) { super(); }

  async process(job: Job<KycJobData>): Promise<void> {
    const data = job.data;
    const processingKey = `kyc:processing:${data.eventId}`;
    const completedKey = `kyc:completed:${data.eventId}`;

    try {
      await this.prisma.$transaction(async (tx) => {
        const investor = await tx.investor.findUnique({ where: { id: data.investorId }, select: { id: true } });
        if (!investor) throw new Error(`Investor ${data.investorId} not found`);
        await tx.investor.update({ where: { id: data.investorId }, data: { kyc_status: data.newStatus } });
        await tx.webhookEvent.create({
          data: {
            event_id: data.eventId,
            provider: data.provider,
            payload: data.payload as unknown as Prisma.InputJsonValue,
            investor_id: data.investorId,
          },
        });
      });
      // Mark complete before deleting processing reservation; DB unique event_id is the durable guard.
      await this.redis.set(completedKey, '1', 'EX', 60 * 60 * 24 * 30);
      await this.redis.del(processingKey);
    } catch (error: unknown) {
      // A duplicate DB event means it has already been committed by an earlier attempt.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.redis.set(completedKey, '1', 'EX', 60 * 60 * 24 * 30);
        await this.redis.del(processingKey);
        return;
      }
      throw error; // BullMQ retries; processing reservation remains during retries.
    }
  }
}
