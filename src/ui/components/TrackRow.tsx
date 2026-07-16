import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { IconButton } from './IconButton';
import './components.css';

type TrackRowProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  artist?: string;
  duration?: string;
  imageUrl?: string;
  onMore?: () => void;
};

export function TrackRow(props: TrackRowProps) {
  const className = () => ['ld-track-row', props.class || ''].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      class={className()}
      type={props.type || 'button'}
    >
      <span class="ld-track-row__art" aria-hidden={!props.imageUrl}>
        <Show when={props.imageUrl}>
          <img src={props.imageUrl} alt="" loading="lazy" />
        </Show>
      </span>
      <span class="ld-track-row__content">
        <p class="ld-track-row__title">{props.title}</p>
        <Show when={props.artist}>
          <p class="ld-track-row__meta">{props.artist}</p>
        </Show>
      </span>
      <Show when={props.duration}>
        <span class="ld-track-row__duration">{props.duration}</span>
      </Show>
      <Show when={props.onMore}>
        <IconButton
          label={`More options for ${props.title}`}
          onClick={event => {
            event.stopPropagation();
            props.onMore?.();
          }}
        >
          <span aria-hidden="true">...</span>
        </IconButton>
      </Show>
    </button>
  );
}
