import { config, hostResolver, getArtworkCandidates } from '@utils';
import './ListItem.css';
import { Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import { getList, setListStore } from '@stores';

export default function(data: YTListItem & { rowSubtitle?: string }) {

  const sources = createMemo(() => getArtworkCandidates(data.img, undefined, data.name));
  const [imageIndex, setImageIndex] = createSignal(0);
  const getThumbnail = () => sources()[imageIndex()] || '';
  createEffect(on(sources, () => setImageIndex(0), { defer: true }));

  function handleError() {
    setImageIndex(index => Math.min(index + 1, sources().length - 1));
  }

  const url = `/${data.type}/${data.id}`;
  const uploaderData = (data as YTPlaylistItem | YTAlbumItem).author || '';
  const stats = (data as YTChannelItem | YTArtistItem).subscribers || (data as YTChannelItem | YTPlaylistItem).videoCount || (data as YTAlbumItem).year || '';

  return (
    <a
      class="listItem listItem--row card card--interactive"
      href={hostResolver(url)}
      onclick={(e) => {
        e.preventDefault();
        setListStore('img', data.img);
        getList(data.id, data.type);
      }}
    >
      <span class="listItem__art">
        <Show when={config.loadImage} fallback={<i class="ri-album-line" aria-hidden="true" />}>
          <img src={getThumbnail()} onError={handleError} alt="" />
        </Show>
      </span>
      <div class="listItem__metadata">
        <p class="title truncate">{data.name}</p>
        <p class="uData truncate">{data.rowSubtitle || [uploaderData, stats].filter(Boolean).join(' • ')}</p>
      </div>
      <i class="ri-arrow-right-s-line listItem__arrow" aria-hidden="true" />
    </a >
  );
}
