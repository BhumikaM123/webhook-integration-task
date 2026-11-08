const { createHmac } = require('node:crypto');
const payload = process.argv[2];
const secret = process.env.KYC_WEBHOOK_SECRET;
if (!payload || !secret) {
  process.stderr.write('Usage: KYC_WEBHOOK_SECRET=... node scripts/sign-webhook.js \'{"event_id":"..."}\'\n');
  process.exit(1);
}
process.stdout.write(createHmac('sha256', secret).update(payload).digest('hex') + '\n');
