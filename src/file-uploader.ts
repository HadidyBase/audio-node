import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { AudioClient } from '@hadidyapp/audio-sdk';
import type { Job, JobCreateOptionsV1 } from '@hadidyapp/audio-sdk';

export interface UploadFromPathOptions extends JobCreateOptionsV1 {
  onProgress?: (percent: number) => void;
}

export async function uploadFromPath(
  client: AudioClient,
  filePath: string,
  options: UploadFromPathOptions,
): Promise<Job> {
  if (!filePath) throw new TypeError('filePath must be a non-empty string');

  // Normalize to absolute path — makes traversal sequences visible and resolves symlinks (H-1 fix)
  const resolvedPath = resolve(filePath);

  const { onProgress, ...jobOptions } = options;

  const fileStats = await stat(resolvedPath);
  const totalBytes = fileStats.size;
  const filename = basename(resolvedPath);

  let uploadedBytes = 0;
  const stream = createReadStream(resolvedPath);

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    const buf = chunk instanceof Buffer ? chunk : Buffer.from(chunk as ArrayBuffer);
    chunks.push(new Uint8Array(buf));
    uploadedBytes += buf.length;
    onProgress?.(Math.round((uploadedBytes / totalBytes) * 100));
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return client.jobs.create(merged, { ...jobOptions, filename } as JobCreateOptionsV1 & { filename?: string });
}
