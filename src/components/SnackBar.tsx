import { createEffect, onCleanup } from "solid-js";
import { setStore, store } from "@stores";
import "./SnackBar.css";

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

  return (
    <button
      class="snackbar-toast"
      type="button"
      aria-live="polite"
      role="status"
      onclick={() => setStore('snackbar', undefined)}
    >
      <span class="snackbar-toast__icon" aria-hidden="true">
        <i class="ri-checkbox-circle-fill" />
      </span>
      <span class="snackbar-toast__content">
        {store.snackbar}
      </span>
    </button>
  );
}
