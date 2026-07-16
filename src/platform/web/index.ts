import type { PlatformServices } from '../contracts';
import { webStorage } from './storage';
import { createWebStreamProvider } from './streaming';

export const webPlatform: PlatformServices = {
  runtime: 'web',
  storage: webStorage
};

export { webStorage };
export { createWebStreamProvider };
