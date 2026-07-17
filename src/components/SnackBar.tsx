import { createEffect, onCleanup } from "solid-js";
import { setStore, store } from "@stores";
import "./SnackBar.css";

type ToastType = 'success' | 'error' | 'warning' | 'info';

function getSnackbarMessage() {
  const snackbar = store.snackbar;
  return typeof snackbar === 'string' ? snackbar : snackbar?.message || '';
}

function inferToastType(message: string): ToastType {
  const text = message.toLowerCase();

  if (/(failed|error|no se pudo|no fue posible|not found|unauthenticated|incompatible|fall[oó]|failed)/i.test(text)) {
    return 'error';
  }

  if (/(limit|exceeded|warning|reload|not enough|no hay|no valid|does not exist)/i.test(text)) {
    return 'warning';
  }

  if (/(loading|syncing|processing|downloading|updating|reintentando|verifying)/i.test(text)) {
    return 'info';
  }

  return 'success';
}

function getSnackbarType(): ToastType {
  const snackbar = store.snackbar;
  if (typeof snackbar !== 'string' && snackbar?.type) return snackbar.type;
  return inferToastType(getSnackbarMessage());
}

const icons: Record<ToastType, string> = {
  success: 'ri-checkbox-circle-fill',
  error: 'ri-error-warning-fill',
  warning: 'ri-alert-fill',
  info: 'ri-information-fill'
};

export default function() {
  createEffect(() => {
    const message = store.snackbar;
    if (!message) return;

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
    <button
      class="snackbar-toast"
      classList={{ [`snackbar-toast--${type()}`]: true }}
      type="button"
      aria-live="polite"
      role={type() === 'error' || type() === 'warning' ? 'alert' : 'status'}
      onclick={() => setStore('snackbar', undefined)}
    >
      <span class="snackbar-toast__icon" aria-hidden="true">
        <i class={icons[type()]} />
      </span>
      <span class="snackbar-toast__content">
        {message()}
      </span>
    </button>
  );
}
