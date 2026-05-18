import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import type { AudioClient } from '@hadidyapp/audio-sdk';

export interface DownloadToPathOptions {
  onProgress?: (downloadedBytes: number) => void;
  /**
   * Abort the download if it takes longer than this many milliseconds.
   * Prevents disk exhaustion from an infinitely-streaming response.
   * Default: 600 000 ms (10 minutes).
   */
  downloadTimeoutMs?: number;
}

export async function downloadToPath(
  client: AudioClient,
  jobId: string,
  outputPath: string,
  options: DownloadToPathOptions = {},
): Promise<void> {
  if (!outputPath) throw new TypeError('outputPath must be a non-empty string');

  // resolve() normalises the path but does not restrict it to an allow-list.
  // Callers are responsible for validating user-supplied paths before passing them here.
  const resolvedPath = resolve(outputPath);

  const { onProgress, downloadTimeoutMs = 600_000 } = options;

  const { url } = await client.jobs.getOutput(jobId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), downloadTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

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
