# @hadidyapp/audio-node-sdk

Node.js 22+ extensions for the [Hadidy Audio](https://hadidy.com) SDK. Extends `@hadidyapp/audio-sdk` with disk I/O, streaming uploads, and drop-in webhook verification middleware for Express, Fastify, and any raw framework.

## Installation

```bash
npm install @hadidyapp/audio-node-sdk
```

> **Requires Node.js 22+.** All methods from `@hadidyapp/audio-sdk` are available on `AudioNodeClient` — you don't need to install the core SDK separately.

---

## Quick Start — Upload and Download

```typescript
import { AudioNodeClient } from '@hadidyapp/audio-node-sdk';

const client = new AudioNodeClient({ apiKey: process.env.HADIDY_API_KEY! });

// Upload a file from disk with progress reporting
const job = await client.uploadFromPath('./podcast.wav', {
  output_format: 'mp3',
  bitrate: '192k',
  onProgress: (pct) => process.stdout.write(`\rUploading: ${pct}%`),
});

// Wait for transcoding to finish
await client.jobs.waitForCompletion(job.id);

// Download the output to disk
await client.downloadToPath(job.id, './output/podcast.mp3', {
  onProgress: (bytes) => process.stdout.write(`\rDownloaded: ${bytes} bytes`),
});
```

---

## Streaming Upload

Upload from any Node.js `Readable` stream without buffering to disk first.

```typescript
import { AudioNodeClient } from '@hadidyapp/audio-node-sdk';
import { createReadStream } from 'node:fs';

const client = new AudioNodeClient({ apiKey: process.env.HADIDY_API_KEY! });

const stream = createReadStream('./recording.flac');
const job = await client.uploadFromStream(stream, 'recording.flac', {
  output_format: 'aac',
  bitrate: '256k',
});

await client.jobs.waitForCompletion(job.id);
console.log(job.id, 'complete');
```

---

## Webhook Verification — Express

```typescript
import { WebhookVerifier } from '@hadidyapp/audio-node-sdk';
import express from 'express';

const verifier = new WebhookVerifier(process.env.HADIDY_WEBHOOK_SECRET!);
const app = express();

// Must use express.raw() — JSON middleware would break HMAC verification
app.post(
  '/hooks/hadidy',
  express.raw({ type: 'application/json' }),
  verifier.expressMiddleware(),
  (req, res) => {
    const event = JSON.parse(req.body.toString());
    console.log(event.type, event.data);
    res.status(200).end();
  }
);
```

---

## Webhook Verification — Fastify

```typescript
import { WebhookVerifier } from '@hadidyapp/audio-node-sdk';
import Fastify from 'fastify';

const verifier = new WebhookVerifier(process.env.HADIDY_WEBHOOK_SECRET!);
const fastify = Fastify();

// Required: preserve the raw body so HMAC can be verified against the original bytes.
// Must be registered before fastify.register(verifier.fastifyPlugin()).
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  (req as any).rawBody = body;
  done(null, JSON.parse(body.toString()));
});

// Register the plugin — it adds a preHandler that verifies every request.
fastify.register(verifier.fastifyPlugin());

fastify.post('/hooks/hadidy', async (request, reply) => {
  const event = request.body as { type: string; data: unknown };
  console.log(event.type, event.data);
  reply.status(200).send({ ok: true });
});
```

---

## Webhook Verification — Any Framework (raw)

For Hono, Bun.serve, Deno, or any custom HTTP handler:

```typescript
import { WebhookVerifier } from '@hadidyapp/audio-node-sdk';

const verifier = new WebhookVerifier(process.env.HADIDY_WEBHOOK_SECRET!);

// Example: Bun.serve
Bun.serve({
  async fetch(req) {
    if (req.method === 'POST' && new URL(req.url).pathname === '/hooks/hadidy') {
      const rawBody = await req.text();
      const sig = req.headers.get('x-webhook-signature') ?? '';

      if (!verifier.verify(rawBody, sig)) {
        return new Response('Unauthorized', { status: 401 });
      }

      const event = JSON.parse(rawBody);
      console.log(event.type, event.data);
      return new Response('OK');
    }
    return new Response('Not Found', { status: 404 });
  },
});
```

---

## API

### `AudioNodeClient`

Extends `AudioClient` from `@hadidyapp/audio-sdk`. All core resources (`jobs`, `presets`, `live`, etc.) are available.

| Method | Signature | Description |
|---|---|---|
| `uploadFromPath` | `(filePath: string, options: JobOptions & { onProgress?: (pct: number) => void }) => Promise<Job>` | Upload a file from disk; `onProgress` reports 0–100 |
| `downloadToPath` | `(jobId: string, outputPath: string, options?: { onProgress?: (bytes: number) => void }) => Promise<void>` | Stream output file to disk |
| `uploadFromStream` | `(stream: Readable, filename: string, options: JobOptions) => Promise<Job>` | Upload from any Node.js `Readable` |

### `WebhookVerifier`

| Method | Description |
|---|---|
| `verify(rawBody, signature)` | HMAC-SHA256 timing-safe check. `rawBody` can be `string` or `Buffer`. Returns `boolean`. |
| `expressMiddleware()` | Returns Express middleware. Replies `401` on invalid signature. |
| `fastifyPlugin()` | Returns a Fastify plugin. Replies `401` on invalid signature. |

---

## License

MIT
