import type { PlatformServices } from '../contracts';
import { webStorage } from './storage';
import { webStreamingCredentials } from './streamingCredentials';
import { createWebStreamProvider } from './streaming';

export const webPlatform: PlatformServices = {
  runtime: 'web',
  storage: webStorage,
  streamingCredentials: webStreamingCredentials
};

export { webStorage };
export { webStreamingCredentials };
export { createWebStreamProvider };
