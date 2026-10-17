import { createEffect, onCleanup, Show } from "solid-js";
import { setStore, store } from "@stores";
import "./SnackBar.css";

type ToastType = 'success' | 'error' | 'info';

function getSnackbarMessage() {
  const snackbar = store.snackbar;
  return typeof snackbar === 'string' ? snackbar : snackbar?.message || '';
}

function inferToastType(message: string): ToastType {
  const text = message.toLowerCase();

  if (/(failed|error|no se pudo|no fue posible|not found|unauthenticated|incompatible|fall[oó]|failed)/i.test(text)) {
    return 'error';
  }

  if (/(loading|syncing|processing|downloading|updating|reintentando|verifying)/i.test(text)) {
    return 'info';
  }

  return 'success';
}

function getSnackbarType(): ToastType {
  const snackbar = store.snackbar;
  if (typeof snackbar !== 'string' && snackbar?.type)
    return snackbar.type === 'warning' ? 'info' : snackbar.type;
  return inferToastType(getSnackbarMessage());
}

function isWarningMessage() {
  return typeof store.snackbar !== 'string' && store.snackbar?.type === 'warning';
}

const icons: Record<ToastType, string> = {
  success: 'ri-checkbox-circle-fill',
  error: 'ri-error-warning-fill',
  info: 'ri-information-fill'
};

export default function() {
  createEffect(() => {
    const message = store.snackbar;
    if (!message) return;

    if (isWarningMessage()) {
      setStore('snackbar', undefined);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (store.snackbar === message) {
        setStore('snackbar', undefined);
      }
    }, 4200);

    onCleanup(() => window.clearTimeout(timeoutId));
  });

  const message = () => getSnackbarMessage();
  const type = () => getSnackbarType();

  return (
    <Show when={!isWarningMessage()}>
      <button
        class="snackbar-toast"
        classList={{ [`snackbar-toast--${type()}`]: true }}
        type="button"
        aria-live="polite"
        role={type() === 'error' ? 'alert' : 'status'}
        onclick={() => setStore('snackbar', undefined)}
      >
        <span class="snackbar-toast__icon" aria-hidden="true">
          <i class={icons[type()]} />
        </span>
        <span class="snackbar-toast__content">
          {message()}
        </span>
      </button>
    </Show>
  );
}
