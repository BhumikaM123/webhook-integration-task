import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class WebhookSignatureService {
  private readonly logger = new Logger(WebhookSignatureService.name);
  constructor(private readonly config: ConfigService) {}

  verify(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = this.config.get<string>('KYC_WEBHOOK_SECRET');
    if (!secret || !signatureHeader) {
      this.logger.warn('Webhook rejected: missing signing secret or signature header');
      return false;
    }
    const supplied = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
    if (!/^[a-fA-F0-9]{64}$/.test(supplied)) {
      this.logger.warn('Webhook rejected: malformed HMAC signature');
      return false;
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    const received = Buffer.from(supplied, 'hex');
    const valid = received.length === expected.length && timingSafeEqual(expected, received);
    if (!valid) this.logger.warn('Webhook rejected: HMAC signature mismatch');
    return valid;
  }
}
