import { createSignal, Show } from 'solid-js';
import { setStore, t } from '@stores';
import { fetchCollection, importYoutubePlaylist, playlistIdFromURL } from '@utils';
import { Button, Input, Modal } from '../../ui/components';

type ImportYoutubePlaylistModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ImportYoutubePlaylistModal(props: ImportYoutubePlaylistModalProps) {
  const [url, setUrl] = createSignal('');
  const [error, setError] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  function resetState() {
    setUrl('');
    setError('');
  }

  function closeModal() {
    if (isSubmitting()) return;
    resetState();
    props.onClose();
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    const nextUrl = url().trim();
    if (!playlistIdFromURL(nextUrl)) {
      setError(t('library_youtube_playlist_invalid_url'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await importYoutubePlaylist(nextUrl);
      resetState();
      props.onClose();
      setStore('snackbar', t('library_youtube_playlist_imported', result.title));
      fetchCollection(result.title);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t('library_youtube_playlist_fetch_error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={props.open}
      title={t('library_import_youtube_playlist')}
      class="library-playlist-modal-panel"
      onClose={closeModal}
    >
      <form class="library-playlist-modal" onSubmit={handleSubmit}>
        <div class="library-playlist-modal__intro">
          <span class="library-playlist-modal__intro-icon" aria-hidden="true">
            <i class="ri-music-2-line"></i>
          </span>
          <div>
            <p>{t('library_youtube_playlist_modal_intro_title')}</p>
            <span>{t('library_youtube_playlist_modal_intro')}</span>
          </div>
        </div>

        <div class="library-playlist-modal__field">
          <Input
            autofocus
            label={t('library_youtube_playlist_url')}
            helperText={t('library_youtube_playlist_helper')}
            name="youtube-playlist-url"
            placeholder="https://www.youtube.com/playlist?list=..."
            value={url()}
            onInput={event => {
              setUrl(event.currentTarget.value);
              if (error()) setError('');
            }}
          />
        </div>

        <Show when={error()}>
          <p class="library-playlist-modal__error">{error()}</p>
        </Show>

        <div class="library-playlist-modal__note">
          <i class="ri-information-line" aria-hidden="true"></i>
          <span>{t('library_youtube_playlist_modal_note')}</span>
        </div>

        <div class="library-playlist-modal__actions">
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting()}
            onClick={closeModal}
          >
            {t('common_close')}
          </Button>
          <Button type="submit" disabled={isSubmitting()}>
            <i class={isSubmitting() ? 'ri-loader-3-line loading-spinner' : 'ri-play-list-add-line'} aria-hidden="true" />
            {t(isSubmitting() ? 'library_youtube_playlist_importing' : 'library_youtube_playlist_submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
