import type { PlatformServices } from './contracts';
import { webPlatform } from './web';

export type {
  PlatformServices,
  Runtime,
  StoragePort,
  StreamingCredentials,
  StreamingCredentialsPort
} from './contracts';

export const platform: PlatformServices = webPlatform;
