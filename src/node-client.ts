import { AudioClient, type AudioClientOptions } from '@hadidyapp/audio-sdk';
import type { Job, JobCreateOptionsV1 } from '@hadidyapp/audio-sdk';
import { uploadFromPath, type UploadFromPathOptions } from './file-uploader.js';
import { downloadToPath, type DownloadToPathOptions } from './file-downloader.js';
import { Readable } from 'node:stream';

export class AudioNodeClient extends AudioClient {
  constructor(options: AudioClientOptions) {
    super(options);
  }

  async uploadFromPath(
    filePath: string,
    options: UploadFromPathOptions,
  ): Promise<Job> {
    return uploadFromPath(this, filePath, options);
  }

  async downloadToPath(
    jobId: string,
    outputPath: string,
    options?: DownloadToPathOptions,
  ): Promise<void> {
    return downloadToPath(this, jobId, outputPath, options);
  }

  async uploadFromStream(
    stream: NodeJS.ReadableStream,
    filename: string,
    options: JobCreateOptionsV1,
  ): Promise<Job> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk as unknown as ArrayBuffer));
    }
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return this.jobs.create(merged, { ...options, filename } as JobCreateOptionsV1 & { filename?: string });
  }
}
