import type { StoragePort } from './storage';
import type { StreamingCredentialsPort } from './streamingCredentials';

export type Runtime = "web" | "tauri";

export interface PlatformServices {
  runtime: Runtime;
  storage: StoragePort;
  streamingCredentials: StreamingCredentialsPort;
}

export type { StoragePort };
export type { StreamingCredentials, StreamingCredentialsPort } from './streamingCredentials';
