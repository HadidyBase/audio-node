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
    // Convert the Node.js Readable to a WHATWG ReadableStream, then read into
    // a Blob via Response. This avoids the previous double-buffering (chunk
    // array → merged Uint8Array → another copy on upload).
    const webStream = Readable.toWeb(stream as NodeJS.ReadableStream & { readable: true }) as ReadableStream<Uint8Array>;
    const blob = await new Response(webStream).blob();
    const file = new File([blob], filename);
    return this.jobs.create(file, { ...options, filename } as JobCreateOptionsV1 & { filename?: string });
  }
}
