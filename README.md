# @hadidyapp/audio-node

Node.js 22+ extensions for the Hadidy Audio SDK. Extends `@hadidyapp/audio-sdk` with disk I/O, streaming uploads, and webhook verification middleware.

## Installation

```bash
npm install @hadidyapp/audio-node @hadidyapp/audio-sdk
```

## Quick Start

```typescript
import { AudioNodeClient } from '@hadidyapp/audio-node';

const client = new AudioNodeClient({ apiKey: process.env.HADIDY_API_KEY! });

// Upload from disk with progress
const job = await client.uploadFromPath('./podcast.wav', {
  output_format: 'mp3',
  bitrate: '192k',
  onProgress: (pct) => console.log(`Upload: ${pct}%`),
});

await client.jobs.waitForCompletion(job.id);
await client.downloadToPath(job.id, './output/podcast.mp3', {
  onProgress: (bytes) => console.log(`Downloaded: ${bytes} bytes`),
});
```

## Webhook Verification

```typescript
import { WebhookVerifier } from '@hadidyapp/audio-node';
import express from 'express';

const verifier = new WebhookVerifier(process.env.HADIDY_WEBHOOK_SECRET!);
const app = express();

app.post('/hooks/hadidy', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verifier.verify(req.body, req.headers['x-webhook-signature'] as string)) {
    return res.status(401).end();
  }
  const event = JSON.parse(req.body.toString());
  console.log(event.type, event.data);
  res.status(200).end();
});
```

## API

### `AudioNodeClient`

Extends `AudioClient` from `@hadidyapp/audio-sdk` with:

- `uploadFromPath(filePath, options)` — upload from disk, optional `onProgress` callback
- `downloadToPath(jobId, outputPath, options?)` — stream output to disk, optional `onProgress`
- `uploadFromStream(stream, filename, options)` — upload from a Node.js readable stream

### `WebhookVerifier`

- `verify(rawBody, signature)` — HMAC-SHA256 timing-safe comparison
- `expressMiddleware()` — drop-in Express middleware
- `fastifyPlugin()` — Fastify plugin

## License

MIT
