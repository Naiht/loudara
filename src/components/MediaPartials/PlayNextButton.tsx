import { playNext, t } from '@stores';

export default function PlayNextButton(props: { disabled?: boolean }) {
  return (
    <button
      aria-label={t('player_play_next')}
      class="ri-skip-forward-fill"
      classList={{ 'is-disabled': !!props.disabled }}
      id="playNextButton"
      aria-disabled={props.disabled ? 'true' : 'false'}
      onclick={() => {
        if (!props.disabled)
          playNext();
      }}
    ></button>
  );
}
