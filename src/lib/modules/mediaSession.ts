import { playerStore, playNext, playPrev, queueStore } from "@stores";
import { isNativeApp } from "@platform/native";
import { pauseNativePlayback, playNativePlayback, seekNativePlayback, stopNativePlayback } from "@platform/native/playback";

const usesNativePlayback = () => isNativeApp && !playerStore.isWatching;

function seek(position: number) {
  if (usesNativePlayback()) void seekNativePlayback(position).catch(console.error);
  else playerStore.audio.currentTime = position;
}

export function initMediaSession() {
  if (!('mediaSession' in navigator)) return;

  const msn = navigator.mediaSession;

  msn.setActionHandler('play', () => {
    if (usesNativePlayback()) void playNativePlayback().catch(console.error);
    else void playerStore.audio.play();
  });

  msn.setActionHandler('pause', () => {
    if (usesNativePlayback()) void pauseNativePlayback().catch(console.error);
    else playerStore.audio.pause();
  });

  msn.setActionHandler('seekbackward', (details) => {
    const skipTime = details.seekOffset || 15;
    seek(Math.max((usesNativePlayback() ? playerStore.currentTime : playerStore.audio.currentTime) - skipTime, 0));
  });

  msn.setActionHandler('seekforward', (details) => {
    const skipTime = details.seekOffset || 15;
    const duration = usesNativePlayback() ? playerStore.fullDuration : playerStore.audio.duration;
    const position = usesNativePlayback() ? playerStore.currentTime : playerStore.audio.currentTime;
    seek(Number.isFinite(duration) && duration > 0 ? Math.min(position + skipTime, duration) : position + skipTime);
  });

  msn.setActionHandler('previoustrack', () => {
    if (queueStore.history.length) {
      playPrev();
    }
  });

  msn.setActionHandler('nexttrack', () => {
    if (queueStore.list.length) {
      playNext();
    }
  });

  msn.setActionHandler('stop', () => {
    if (usesNativePlayback()) void stopNativePlayback().catch(console.error);
    else {
      playerStore.audio.pause();
      playerStore.audio.currentTime = 0;
    }
  });

  msn.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) {
      seek(details.seekTime);
    }
  });
}

export function updateMediaSessionPosition() {
  if (usesNativePlayback() || !('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;

  const { audio } = playerStore;
  if (!isNaN(audio.duration) && audio.duration > 0) {
    try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate || 1,
          position: audio.currentTime,
        });
    } catch (e) {
        console.error("Error updating media session position state:", e);
    }
  }
}

export function updateMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none') {
    if (usesNativePlayback() || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state === 'none' ? 'none' : (state === 'playing' ? 'playing' : 'paused');
}
