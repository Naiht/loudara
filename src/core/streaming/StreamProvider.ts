import type { StreamData } from './types';

export interface StreamProvider {
  getStreamData(
    videoId: string,
    signal?: AbortSignal,
  ): Promise<StreamData>;
}
