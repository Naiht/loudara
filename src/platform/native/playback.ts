import { registerPlugin, type PermissionState, type PluginListenerHandle } from '@capacitor/core';

export type NativePlaybackState = {
  playbackState: 'none' | 'playing' | 'paused' | 'loading';
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  loop: boolean;
  ended?: boolean;
  error?: string;
};

export type NativeTransportAction = 'previous' | 'next';

type PrepareTrackOptions = {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  duration?: number;
  position?: number;
  autoplay?: boolean;
  loop?: boolean;
  playbackRate?: number;
  volume?: number;
};

type NativePlaybackPlugin = {
  prepareTrack(options: PrepareTrackOptions): Promise<NativePlaybackState>;
  play(): Promise<NativePlaybackState>;
  pause(): Promise<NativePlaybackState>;
  stop(): Promise<NativePlaybackState>;
  seekTo(options: { position: number }): Promise<NativePlaybackState>;
  setVolume(options: { volume: number }): Promise<NativePlaybackState>;
  setPlaybackRate(options: { playbackRate: number }): Promise<NativePlaybackState>;
  setLoop(options: { loop: boolean }): Promise<NativePlaybackState>;
  getState(): Promise<NativePlaybackState>;
  requestPermissions(): Promise<{ notifications: PermissionState }>;
  addListener(
    eventName: 'playbackStateChange',
    listenerFunc: (state: NativePlaybackState) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'transportControl',
    listenerFunc: (event: { action: NativeTransportAction }) => void
  ): Promise<PluginListenerHandle>;
};

const NativePlayback = registerPlugin<NativePlaybackPlugin>('NativePlayback');

export function addNativePlaybackListener(
  listener: (state: NativePlaybackState) => void
) {
  return NativePlayback.addListener('playbackStateChange', listener);
}

export function addNativeTransportListener(
  listener: (event: { action: NativeTransportAction }) => void
) {
  return NativePlayback.addListener('transportControl', listener);
}

export function prepareNativePlaybackTrack(options: PrepareTrackOptions) {
  return NativePlayback.prepareTrack(options);
}

export function playNativePlayback() {
  return NativePlayback.play();
}

export function pauseNativePlayback() {
  return NativePlayback.pause();
}

export function stopNativePlayback() {
  return NativePlayback.stop();
}

export function seekNativePlayback(position: number) {
  return NativePlayback.seekTo({ position });
}

export function setNativePlaybackVolume(volume: number) {
  return NativePlayback.setVolume({ volume });
}

export function setNativePlaybackRate(playbackRate: number) {
  return NativePlayback.setPlaybackRate({ playbackRate });
}

export function setNativePlaybackLoop(loop: boolean) {
  return NativePlayback.setLoop({ loop });
}

export function getNativePlaybackState() {
  return NativePlayback.getState();
}

export function requestNativePlaybackPermissions() {
  return NativePlayback.requestPermissions();
}
