import type { StreamAttempt } from './types';

export class StreamHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'StreamHttpError';
  }
}

export class StreamTimeoutError extends Error {
  constructor(message = 'Stream provider timed out') {
    super(message);
    this.name = 'StreamTimeoutError';
  }
}

export class InvalidStreamResponseError extends Error {
  constructor(message = 'Invalid stream response') {
    super(message);
    this.name = 'InvalidStreamResponseError';
  }
}

export class NoAudioStreamsError extends Error {
  constructor(message = 'No audio streams found') {
    super(message);
    this.name = 'NoAudioStreamsError';
  }
}

export class StreamUnavailableError extends Error {
  constructor(
    public readonly videoId: string,
    public readonly attempts: StreamAttempt[],
  ) {
    super(`No fue posible obtener un stream para ${videoId}`);
    this.name = 'StreamUnavailableError';
  }
}
