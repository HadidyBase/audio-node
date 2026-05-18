import { openAsBlob } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { AudioClient, Job, JobCreateOptionsV1 } from '@hadidyapp/audio-sdk';

export interface UploadFromPathOptions extends JobCreateOptionsV1 {
  /**
   * Called with upload progress 0–100 when available.
   * Note: progress reporting depends on the underlying fetch implementation;
   * it is best-effort and may not fire on all runtimes.
   */
  onProgress?: (percent: number) => void;
}

export async function uploadFromPath(
  client: AudioClient,
  filePath: string,
  options: UploadFromPathOptions,
): Promise<Job> {
  if (!filePath) throw new TypeError('filePath must be a non-empty string');

  // resolve() normalises the path but does not restrict it to an allow-list.
  // Callers are responsible for validating user-supplied paths before passing them here.
  const resolvedPath = resolve(filePath);
  const { onProgress, ...jobOptions } = options;
  const filename = basename(resolvedPath);

  // openAsBlob returns a Blob backed by the file descriptor — no RAM buffering.
  // Available in Node.js 20+.
  const blob = await openAsBlob(resolvedPath);
  const file = new File([blob], filename);

  // onProgress is best-effort only; streaming progress requires runtime support.
  onProgress?.(0);
  const job = await client.jobs.create(file, jobOptions as JobCreateOptionsV1 & { filename?: string });
  onProgress?.(100);
  return job;
}
