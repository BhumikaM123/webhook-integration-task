import { WebhookSignatureService } from './webhook-signature.service';
import { createHmac } from 'node:crypto';

describe('WebhookSignatureService', () => {
  const secret = 'test-secret';
  const raw = Buffer.from('{"event_id":"evt-1"}');
  const config = { get: (key: string) => key === 'KYC_WEBHOOK_SECRET' ? secret : undefined } as never;
  it('accepts a valid SHA-256 HMAC', () => {
    const signature = createHmac('sha256', secret).update(raw).digest('hex');
    expect(new WebhookSignatureService(config).verify(raw, signature)).toBe(true);
  });
  it('rejects an invalid signature', () => {
    expect(new WebhookSignatureService(config).verify(raw, '0'.repeat(64))).toBe(false);
  });
});
