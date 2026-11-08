import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req, UnauthorizedException, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Request } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.constants';
import { KycWebhookPayload } from '../common/types';
import { KycQueueService } from './kyc-queue.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { KycWebhookDto } from './kyc-webhook.dto';

@Controller('webhooks')
export class KycWebhookController {
  private readonly logger = new Logger(KycWebhookController.name);
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly signature: WebhookSignatureService,
    private readonly queue: KycQueueService,
    private readonly config: ConfigService,
  ) {}

  @Post('kyc')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async receive(
    @Req() req: Request,
    @Headers('x-kyc-signature') signatureHeader: string | undefined,
    // DTO validation runs after signature verification; body is checked below too.
  ): Promise<{ message: string; duplicate?: boolean }> {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !this.signature.verify(rawBody, signatureHeader)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const body = req.body as Partial<KycWebhookDto>;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        typeof body.event_id !== 'string' || body.event_id.length < 1 || body.event_id.length > 200 ||
        typeof body.investor_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.investor_id) ||
        typeof body.new_status !== 'string' || !['pending', 'approved', 'rejected', 'under_review'].includes(body.new_status) ||
        typeof body.timestamp !== 'string' || Number.isNaN(Date.parse(body.timestamp))) {
      throw new BadRequestException('Invalid webhook payload');
    }
    const payload: KycWebhookPayload = {
      event_id: body.event_id,
      investor_id: body.investor_id,
      new_status: body.new_status,
      timestamp: body.timestamp,
    };
    const processingKey = `kyc:processing:${payload.event_id}`;
    const completedKey = `kyc:completed:${payload.event_id}`;

    // Retain a completed marker (TTL) while clearing the processing reservation after success.
    const completed = await this.redis.exists(completedKey);
    if (completed) return { message: 'Webhook already processed', duplicate: true };

    const reserved = await this.redis.set(processingKey, '1', 'EX', 3600, 'NX');
    if (reserved !== 'OK') return { message: 'Webhook already queued or processing', duplicate: true };

    try {
      await this.queue.enqueue({
        eventId: payload.event_id,
        investorId: payload.investor_id,
        newStatus: payload.new_status,
        provider: this.config.get<string>('KYC_PROVIDER_NAME', 'identity-provider'),
        payload,
      });
      return { message: 'Webhook accepted for processing' };
    } catch (error: unknown) {
      await this.redis.del(processingKey);
      this.logger.error(`Failed to enqueue webhook ${payload.event_id}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}
