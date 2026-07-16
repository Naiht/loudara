import type { StoragePort } from './storage';

export type Runtime = "web" | "tauri";

export interface PlatformServices {
  runtime: Runtime;
  storage: StoragePort;
}

export type { StoragePort };
