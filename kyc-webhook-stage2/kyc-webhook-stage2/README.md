# KYC Webhook Integration Service — Stage 2

NestJS (Express adapter) + TypeScript + PostgreSQL/Prisma + Redis/BullMQ. Implements the two endpoints in the assessment.

## Requirements

- Node.js 20+
- Docker Compose
- npm

## Run locally (two commands after cloning)

1. `docker compose up -d --wait`
2. `npm install && cp .env.example .env && npx prisma generate && npx prisma migrate dev --name init && npm run start:dev`

The second command installs dependencies, prepares the database, and starts the API. The API listens on `http://localhost:3000`. The BullMQ processor is registered in the Nest application and consumes jobs while the API is running. For a separate worker process, use `npm run worker:dev` in another terminal after setup.

After initial setup, start the API with `npm run start:dev` and (optionally) a separate worker with `npm run worker:dev`.

## Environment

Copy `.env.example` to `.env` and replace both secrets with strong random values. Required variables: `DATABASE_URL`, `REDIS_URL`, `KYC_WEBHOOK_SECRET`, `JWT_SECRET`. Optional: `PORT`, `KYC_PROVIDER_NAME`.

## Database schema

The supplied Tenant, Investor and WebhookEvent models are retained. `WebhookEvent` is extended with `investor_id` and a relation/index so the GET endpoint can retrieve the most recent event for a specific investor, as required by the assessment.

## Endpoints

### 1. `POST /webhooks/kyc`

Headers: `X-KYC-Signature: <hex HMAC-SHA256>` (also accepts `sha256=<hex>`).

The signature is computed over the exact raw JSON request bytes using `KYC_WEBHOOK_SECRET`. Payload:

```json
{
  "event_id": "evt-abc123",
  "investor_id": "22222222-2222-4222-8222-222222222222",
  "new_status": "approved",
  "timestamp": "2026-06-20T14:30:00Z"
}
```

For a local signature, use the exact JSON bytes sent as the body:

```bash
node -e "const c=require('crypto'); const b=JSON.stringify({event_id:'evt-abc123',investor_id:'22222222-2222-4222-8222-222222222222',new_status:'approved',timestamp:'2026-06-20T14:30:00Z'}); console.log(c.createHmac('sha256',process.env.KYC_WEBHOOK_SECRET).update(b).digest('hex'))"
```

The endpoint verifies HMAC, validates fields, reserves the event in Redis using `SET NX`, enqueues BullMQ, and acknowledges only after enqueue succeeds. Duplicate deliveries return 200 without another job. Queue failures release the reservation and return 500.

Idempotency uses a processing reservation (`kyc:processing:<event_id>`) and a completed marker (`kyc:completed:<event_id>`). The worker transactionally updates Investor and inserts WebhookEvent, sets the completed marker, then clears the processing key. The database unique constraint on `WebhookEvent.event_id` is the durable final safeguard. BullMQ job IDs also use the event ID.

### 2. `GET /investors/:id/kyc-status`

Requires `Authorization: Bearer <JWT>`. JWT must contain `tenant_id` and `investor_id`. The route ID must match the token investor ID, and the investor's database tenant must match the token tenant. Response includes `id`, `email`, `kyc_status`, and `last_updated` (null when no event exists).

## Demo data and JWT

After migration, seed the demo investor with:

```bash
npm run seed
```

Generate a demo token (uses `jsonwebtoken` as a dev dependency and the same `JWT_SECRET` from `.env`):

```bash
node -e "console.log(require('jsonwebtoken').sign({tenant_id:'11111111-1111-4111-8111-111111111111',investor_id:'22222222-2222-4222-8222-222222222222'}, process.env.JWT_SECRET, {expiresIn:'1h'}))"
```

Never use the demo secret in production.

## Tests

`npm test` runs the included test suite. Add integration tests against disposable PostgreSQL and Redis instances before production use.

## Architecture note (200–350 words)

The service separates webhook receipt from business processing. The HTTP handler validates the provider's HMAC-SHA256 signature against the exact raw request bytes, validates the payload, reserves the event ID in Redis, and enqueues a BullMQ job. It returns HTTP 200 only after the job has been accepted by the queue, avoiding a synchronous database update in the provider's request/response path. Invalid signatures are logged and rejected with 401; invalid payloads receive 400; infrastructure or enqueue failures receive 500 so the provider can retry.

Redis uses an atomic `SET NX` processing reservation to prevent concurrent deliveries from enqueuing duplicate work. A completed marker is retained with a TTL while the processing reservation is cleared after successful processing, matching the requested cleanup while still allowing duplicate deliveries after completion to be recognized. BullMQ uses an event-derived job ID and bounded retries with exponential backoff. PostgreSQL remains the source of truth: the worker updates the investor and inserts the audit event in one transaction, while the unique `event_id` constraint protects against duplicate commits if Redis state expires or a retry races. In the default startup, `KycWorker` is registered in `WebhookModule` and runs in the API process. The standalone `src/worker.ts` entry point also creates the application context and registers the same processor, so it can be run as a separate worker process when desired. If both the API and standalone worker are running, both can consume jobs from the same queue; BullMQ coordinates job delivery, while the database unique constraint remains the final duplicate safeguard.

The supplied schema is preserved and minimally extended with `WebhookEvent.investor_id` so the GET endpoint can find the latest event for an investor. The GET endpoint verifies JWT claims, checks both investor identity and tenant ownership, and returns only the required fields. Given the timebox, the implementation does not include provider-specific secret rotation, a dead-letter dashboard, distributed tracing, rate limiting, or an outbox pattern. Before production, I would add integration tests, metrics/alerts, secret rotation, dead-letter handling, stricter status-transition rules, and an outbox or equivalent strategy for stronger queue/database consistency.

## AI usage review (300–500 words)

AI assistance was used as a development aid for planning the module structure, checking the assessment requirements, drafting TypeScript scaffolding, and reviewing edge cases around webhook signatures, queue retries, and tenant isolation. The key prompts focused on building the two required endpoints with NestJS/Express, Prisma/PostgreSQL, Redis and BullMQ; preserving the supplied database models; implementing HMAC-SHA256 verification against raw request bytes; and ensuring that the GET endpoint enforces tenant ownership using JWT claims.

The AI was useful for identifying the separation of responsibilities: the controller should authenticate and validate the webhook, Redis should coordinate duplicate detection, BullMQ should manage asynchronous work, and a worker should perform the database transaction. It also highlighted the need for a unique database constraint on `WebhookEvent.event_id`, a queue job ID derived from the event ID, bounded retries, and an investor-specific event relation to support the latest-event timestamp in the GET response.

I reviewed the generated design rather than treating it as production-ready. One important correction was distinguishing a temporary processing reservation from a completed-event marker. Deleting the only Redis key after success would allow a later duplicate delivery to be queued again. The implementation therefore clears the processing key as requested but retains a TTL-based completed marker; PostgreSQL's unique event ID remains the durable safeguard. I also made sure the webhook signature is checked against the raw request body, not a re-serialized JSON object, because whitespace or property ordering changes would otherwise invalidate a legitimate signature. For tenant isolation, I check the JWT investor claim against the route ID and verify the investor's tenant ID from PostgreSQL rather than trusting request-supplied tenant data.

AI-generated code can contain version-specific API assumptions and may omit operational concerns. The project should therefore be installed, built, and tested locally against real PostgreSQL and Redis before submission. The current code is a structured assessment implementation, not a claim of production certification. Any final changes, test results, and AI-assisted portions should be reviewed and accurately described before sharing the repository.

Use `npm run seed` to insert demo tenant/investor data. For a webhook signature, run `KYC_WEBHOOK_SECRET="..." node scripts/sign-webhook.js '<exact JSON body>'`.
