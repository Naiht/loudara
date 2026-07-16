import type { PlatformServices } from './contracts';
import { webPlatform } from './web';

export type { PlatformServices, Runtime, StoragePort } from './contracts';

export const platform: PlatformServices = webPlatform;
