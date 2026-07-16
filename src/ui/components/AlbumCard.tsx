import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import './components.css';

type AlbumCardProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  subtitle?: string;
  imageUrl?: string;
};

export function AlbumCard(props: AlbumCardProps) {
  const className = () => ['ld-album-card', props.class || ''].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      class={className()}
      type={props.type || 'button'}
    >
      <span class="ld-album-card__art" aria-hidden={!props.imageUrl}>
        <Show when={props.imageUrl}>
          <img src={props.imageUrl} alt="" loading="lazy" />
        </Show>
      </span>
      <span>
        <p class="ld-album-card__title">{props.title}</p>
        <Show when={props.subtitle}>
          <p class="ld-album-card__meta">{props.subtitle}</p>
        </Show>
      </span>
    </button>
  );
}
