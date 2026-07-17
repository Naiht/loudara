import { isTauri } from '@tauri-apps/api/core';
import type { PlatformServices } from '../contracts';
import { webStorage } from '../web/storage';
import { webStreamingCredentials } from '../web/streamingCredentials';

export function isTauriRuntimeAvailable() {
  try {
    return typeof window !== 'undefined' && isTauri();
  } catch {
    return false;
  }
}

export const tauriPlatform: PlatformServices = {
  runtime: 'tauri',
  storage: webStorage,
  streamingCredentials: webStreamingCredentials
};
