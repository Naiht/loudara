import { createEffect, onCleanup, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { IconButton } from './IconButton';
import './components.css';

type ModalProps = {
  open: boolean;
  title: string;
  children: JSX.Element;
  class?: string;
  onClose: () => void;
};

export function Modal(props: ModalProps) {
  createEffect(() => {
    if (!props.open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => document.removeEventListener('keydown', onKeyDown));
  });

  const className = () => ['ld-modal__panel', props.class || ''].filter(Boolean).join(' ');

  return (
    <Show when={props.open}>
      <div
        aria-modal="true"
        class="ld-modal"
        role="dialog"
        onClick={event => {
          if (event.currentTarget === event.target) props.onClose();
        }}
      >
        <section class={className()} aria-labelledby="ld-modal-title">
          <header class="ld-modal__header">
            <h2 class="ld-modal__title" id="ld-modal-title">{props.title}</h2>
            <IconButton label="Close" onClick={props.onClose}>
              <span aria-hidden="true">x</span>
            </IconButton>
          </header>
          <div class="ld-modal__body">{props.children}</div>
        </section>
      </div>
    </Show>
  );
}
