import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import type { AudioClient } from '@hadidyapp/audio-sdk';

export interface DownloadToPathOptions {
  onProgress?: (downloadedBytes: number) => void;
}

export async function downloadToPath(
  client: AudioClient,
  jobId: string,
  outputPath: string,
  options: DownloadToPathOptions = {},
): Promise<void> {
  if (!outputPath) throw new TypeError('outputPath must be a non-empty string');

  // Normalize to absolute path — makes traversal sequences visible (H-1 fix)
  const resolvedPath = resolve(outputPath);

  const { onProgress } = options;

  const { url } = await client.jobs.getOutput(jobId);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download job output: HTTP ${response.status}`);
  }

  const writer = createWriteStream(resolvedPath);
  let downloaded = 0;

  const trackingStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      downloaded += chunk.length;
      onProgress?.(downloaded);
      controller.enqueue(chunk);
    },
  });

  const nodeReadable = Readable.fromWeb(
    response.body.pipeThrough(trackingStream) as ReadableStream<Uint8Array>,
  );

  await pipeline(nodeReadable, writer);
}
