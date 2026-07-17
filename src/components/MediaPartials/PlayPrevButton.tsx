import { playPrev, t } from '@stores';

export default function PlayPrevButton(props: { disabled?: boolean }) {
  return (
    <button
      aria-label={t('player_play_previous')}
      class="ri-skip-back-fill"
      classList={{ 'is-disabled': !!props.disabled }}
      id="playPrevButton"
      aria-disabled={props.disabled ? 'true' : 'false'}
      onclick={() => {
        if (!props.disabled)
          playPrev();
      }}
    ></button>
  );
}
