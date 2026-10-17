import { registerPlugin } from '@capacitor/core';

const NativeDownload = registerPlugin<{
  download(options: { url: string; title: string; artist: string }): Promise<{ folder: string }>;
}>('NativeDownload');

export function downloadNativeMp3(options: { url: string; title: string; artist: string }) {
  return NativeDownload.download(options);
}
