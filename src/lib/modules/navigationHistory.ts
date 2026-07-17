import { createEffect, createSignal, onCleanup } from 'solid-js';
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
  onCleanup(() => window.removeEventListener('popstate', handlePopState));
}
