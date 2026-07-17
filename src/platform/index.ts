import type { PlatformServices } from './contracts';
import { isTauriRuntimeAvailable, tauriPlatform } from './tauri';
import { webPlatform } from './web';

export type {
  PlatformServices,
  Runtime,
  StoragePort,
  StreamingCredentials,
  StreamingCredentialsPort
} from './contracts';

export const platform: PlatformServices = isTauriRuntimeAvailable()
  ? tauriPlatform
  : webPlatform;
