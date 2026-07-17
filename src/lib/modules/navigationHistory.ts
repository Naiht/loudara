import { createEffect, createSignal, onCleanup } from 'solid-js';
import { Capacitor } from '@capacitor/core';
import {
  applyNavigationSnapshot,
  getNavigationSnapshot,
  isNavigationSnapshot,
  mergeNavigationHistoryState,
  NavigationSnapshot
} from '@stores';

type LoudaraHistoryState = {
  loudaraNav?: NavigationSnapshot
};

const [isReady, setReady] = createSignal(false);
let isApplyingBrowserState = false;
let lastSnapshot = '';

function serializeSnapshot(snapshot: NavigationSnapshot) {
  return `${snapshot.active}:${snapshot.queue ? 'queue' : 'main'}:${snapshot.player ? 'player' : 'main'}`;
}

function getStateSnapshot(state: unknown) {
  const snapshot = (state as LoudaraHistoryState | null)?.loudaraNav;
  return isNavigationSnapshot(snapshot) ? snapshot : undefined;
}

export function initNavigationHistory() {
  const snapshot = getNavigationSnapshot();
  lastSnapshot = serializeSnapshot(snapshot);
  history.replaceState(mergeNavigationHistoryState(snapshot), '', location.href);
  setReady(true);
}

export function useNavigationHistory() {
  createEffect(() => {
    const snapshot = getNavigationSnapshot();
    const snapshotKey = serializeSnapshot(snapshot);

    if (!isReady()) {
      lastSnapshot = snapshotKey;
      return;
    }

    if (isApplyingBrowserState) {
      lastSnapshot = snapshotKey;
      return;
    }

    if (snapshotKey === lastSnapshot) return;

    lastSnapshot = snapshotKey;
    history.pushState(mergeNavigationHistoryState(snapshot), '', location.href);
  });

  const handlePopState = (event: PopStateEvent) => {
    const snapshot = getStateSnapshot(event.state);
    if (!snapshot) return;

    isApplyingBrowserState = true;
    lastSnapshot = serializeSnapshot(snapshot);
    applyNavigationSnapshot(snapshot);
    queueMicrotask(() => {
      isApplyingBrowserState = false;
    });
  };

  window.addEventListener('popstate', handlePopState);

  let disposed = false;
  let removeNativeBackListener: (() => Promise<void>) | undefined;

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    void import('@capacitor/app').then(async ({ App }) => {
      if (disposed) return;

      const listener = await App.addListener('backButton', async ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
          return;
        }

        await App.minimizeApp();
      });

      if (disposed) {
        await listener.remove();
        return;
      }

      removeNativeBackListener = () => listener.remove();
    });
  }

  onCleanup(() => {
    disposed = true;
    window.removeEventListener('popstate', handlePopState);
    void removeNativeBackListener?.();
  });
}
