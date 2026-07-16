import { Accessor, Show, createSignal } from 'solid-js';
import './StreamItem.css';
import { config, hostResolver, player, removeFromCollection, getCollectionItems, generateImageUrl } from '@utils';
import { setStore, queueStore, setQueueStore, listStore, navStore, setNavStore, playerStore, setPlayerStore } from '@stores';

export default function(data: YTItem & {
  draggable?: boolean,
  inQueue?: boolean,
  context?: {
    src: Context,
    id: string
  },
  mark?: {
    mode: Accessor<boolean>,
    set: (id: string) => void,
    get: (id: string) => boolean
  },
  removeMode?: boolean
}) {

  const [getImage, setImage] = createSignal('');

  let parent!: HTMLAnchorElement;


  function handleThumbnailLoad(e: Event) {
    const img = e.target as HTMLImageElement;
    const src = getImage();

    if (img.naturalWidth !== 120) {
      parent.classList.remove('ravel');
      return;
    }
    if (src.includes('webp'))
      setImage(src.replace('.webp', '.jpg').replace('vi_webp', 'vi'));
    else {
      // most likely been removed from yt so remove it
      if (data.context?.src)
        removeFromCollection(data.context?.id, [data.id])
    }
  }

  function handleThumbnailError() {

    const src = getImage();

    setImage(
      src.includes('vi_webp') ?
        src.replace('.webp', '.jpg').replace('vi_webp', 'vi') :
        '/logo192.png'
    );

    parent.classList.remove('ravel');
  }



  const isAlbum = data.context?.id.startsWith('MPREb') || listStore.type === 'album';
  const isFromArtist = data.context?.id?.startsWith('Artist - ');
  const isMusic = data.author?.endsWith('- Topic');

  if (config.loadImage && !isAlbum)
    setImage(generateImageUrl(data.img || data.id, 'mq', data.context?.id === 'favorites' || isFromArtist || ((data.context?.src === 'queue') && isMusic)));

  function openActionsMenu(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();
    setStore('actionsMenu', {
      id: data.id,
      title: data.title,
      author: data.author,
      duration: data.duration,
      authorId: data.authorId,
      context: data.context,
      albumId: data.albumId,
      menuPosition: {
        x: rect.right,
        y: rect.bottom + 8
      }
    });
  }

  function buildPlaylistPlaybackContext() {
    if (!data.context || data.context.id === 'history') return null;
    if (data.context.src !== 'collection' && data.context.src !== 'playlists' && data.context.src !== 'channels') return null;

    const sourceItems = data.context.src === 'collection'
      ? getCollectionItems(data.context.id)
      : data.context.src === 'channels' && data.context.id.startsWith('top-tracks:')
        ? listStore.topTracks
        : listStore.list;

    const currentIndex = sourceItems.findIndex(item => item.id === data.id);
    if (currentIndex === -1) return null;

    return {
      previousItems: sourceItems.slice(0, currentIndex).reverse(),
      nextItems: sourceItems.slice(currentIndex + 1)
    };
  }

  return (
    <a
      class='streamItem card card--interactive'
      classList={{
        'ravel': config.loadImage && !isAlbum,
        'marked': data.mark?.get(data.id),
        'delete': data.removeMode
      }}
      href={hostResolver('/watch?v=' + data.id)}
      ref={parent}
      onclick={(e) => {
        e.preventDefault();

        if (data.removeMode) {
          setQueueStore('list', (list) => {
            const index = list.findIndex(item =>
              item.id === data.id &&
              item.context?.id === data.context?.id &&
              item.context?.src === data.context?.src
            );
            if (index !== -1) {
              const newList = [...list];
              newList.splice(index, 1);
              return newList;
            }
            return list;
          });
          return;
        }

        if (data.mark?.mode()) {
          data.mark.set(data.id);
          return;
        }

        const playlistPlaybackContext = buildPlaylistPlaybackContext();

        if (playlistPlaybackContext) {
          setQueueStore('history', playlistPlaybackContext.previousItems);
          setQueueStore('list', playlistPlaybackContext.nextItems);
        } else if (playerStore.stream.id) {
          setQueueStore('history', h => [{ ...playerStore.stream }, ...h]);
        }

        setPlayerStore('stream', {
          id: data.id,
          title: data.title,
          author: data.author || '',
          duration: data.duration,
          authorId: data.authorId || '',
        });

        if (data.albumId)
          setPlayerStore('stream', 'albumId', data.albumId);
        else if (playerStore.stream.albumId)
          setPlayerStore('stream', 'albumId', undefined);


        setPlayerStore('context', {
          id: data.context?.id || '',
          src: data.context?.src || ''
        });


        const isPortrait = matchMedia('(orientation:portrait)').matches;

        if (isPortrait || config.landscapeSections === '1') {
          setNavStore('player', 'state', Boolean(config.watchMode));

          if (config.watchMode)
            navStore.player.ref?.scrollIntoView();
        }
        if (!playlistPlaybackContext && config.contextualFill && !queueStore.isSession && (data.context?.src === 'collection' || (data.context?.src === 'playlists')) && data.context?.id !== 'history') {
          const collectionItems = data.context.src === 'collection' ? getCollectionItems(data.context.id) :
            listStore.list;
          const currentIndex = collectionItems.findIndex(item => item.id === data.id);
          if (currentIndex !== -1) {
            const zigzagQueue: TrackItem[] = [];
            let left = currentIndex - 1;
            let right = currentIndex + 1;
            const len = collectionItems.length;

            const historyIds = new Set(queueStore.history.map(i => i.id));

            while (left >= 0 || right < len) {
              if (right < len) {
                const item = collectionItems[right++];
                if (!historyIds.has(item.id)) zigzagQueue.push(item);
              }
              if (left >= 0) {
                const item = collectionItems[left--];
                if (!historyIds.has(item.id)) zigzagQueue.push(item);
              }
            }
            setQueueStore('list', zigzagQueue);
          }
        }

        player(data.id);

        setQueueStore('list', (list) => {
          const index = list.findIndex(item =>
            item.id === data.id &&
            item.context?.id === data.context?.id &&
            item.context?.src === data.context?.src
          );
          if (index !== -1) {
            const newList = [...list];
            newList.splice(index, 1);
            return newList;
          }
          return list;
        });
      }}
    >
      <span>
        <Show when={!isAlbum && config.loadImage} fallback={data.duration}>
          <img
            crossorigin='anonymous'
            onerror={handleThumbnailError}
            onload={handleThumbnailLoad}
            src={getImage()}
          />
        </Show>
      </span>
      <div class='metadata'>
        <p class='title'>{data.title}</p>
        <div class='avu'>
          <p class='author truncate'>{data.author?.replace(' - Topic', '')}</p>
          <Show when={!isAlbum}>
            <p class='viewsXuploaded truncate'>{data.subtext}</p>
          </Show>
        </div>
      </div>
      <Show when={!isAlbum && data.duration}>
        <p class="streamItem__duration">{data.duration}</p>
      </Show>
      <Show when={data.draggable}>
        <i aria-label="Drag" class="ri-draggable"></i>
      </Show>
      <Show when={!data.draggable && !data.inQueue}>
        <button
          aria-label="More"
          class="streamItem__more"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openActionsMenu(e.currentTarget);
          }}
        >
          <i class="ri-more-2-fill" aria-hidden="true"></i>
        </button>
      </Show>
    </a>
  )
}
