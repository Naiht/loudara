import { Accessor, For, Show, createEffect, lazy, onCleanup, untrack } from "solid-js";
import { listStore, loadAll, loadMoreList, setListStore, t } from "@stores";
import StreamItem from "@components/StreamItem";
import { getCollection, metaUpdater, saveCollection } from "@utils";

const Sortable = lazy(() => import("solid-sortablejs"));

export default function Results(_: {
  draggable: boolean,
  items?: TrackItem[],
  mark?: {
    mode: Accessor<boolean>,
    set: (id: string) => void,
    get: (id: string) => boolean
  }
}) {
  let sentinel!: HTMLDivElement;

  const items = () => _.items || (listStore.list as TrackItem[]);

  const handleReorder = (newList: TrackItem[]) => {
    setListStore('list', newList as YTItem[]);

    if (listStore.type === 'collection') {
      const collectionId = listStore.id;
      const fullCollection = getCollection(collectionId);

      // Since we load from the beginning, newList represents the start of the collection
      const newIds = newList.map(i => i.id);
      const remainingIds = fullCollection.slice(newList.length);

      saveCollection(collectionId, [...newIds, ...remainingIds]);
      metaUpdater(collectionId);
    }
  };

  createEffect(() => {
    const canObserve = Boolean(
      sentinel &&
      listStore.type === 'channels' &&
      listStore.hasContinuation &&
      !listStore.isLoading &&
      !listStore.isLoadingMore
    );

    items().length;

    untrack(() => listStore.observer.disconnect());

    if (!canObserve) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          loadMoreList();
        }
      },
      {
        root: document.querySelector('.app-main__scroller'),
        rootMargin: '420px 0px',
        threshold: 0.01
      }
    );

    observer.observe(sentinel);
    setListStore('observer', observer);
  });

  onCleanup(() => {
    listStore.observer.disconnect();
  });

  return (
    <Show
      when={!listStore.isLoading}
      fallback={<i class="ri-loader-3-line loading-spinner"></i>}
    >
      <div
        class="listContainer"
        classList={{ 'listContainer--single-column': listStore.type === 'channels' }}
      >
        <Show when={_.draggable} fallback={
          <For each={items()}>{
            (item) =>
              <StreamItem
                {...{
                  ...item,
                  type: 'video',
                  context: { id: listStore.name || listStore.id, src: listStore.type as Context }
                }}
                draggable={false}
                mark={_.mark}
              />
          }
          </For>
        }>
          <Sortable
            items={items()}
            setItems={handleReorder}
            idField="id"
            animation={150}
            handle=".ri-draggable"
          >
            {(item: TrackItem) =>
              <StreamItem
                {...{
                  ...item,
                  type: 'video',
                  context: { id: listStore.name || listStore.id, src: listStore.type as Context }
                }}
                draggable={true}
                mark={_.mark}
              />
            }
          </Sortable>
        </Show>
        <Show when={listStore.type === 'playlists' && listStore.hasContinuation}>
          <button class="loadAllBtn" onclick={loadAll}>
            {t('list_load_all')}
          </button>
        </Show>
        <Show when={listStore.type === 'channels'}>
          <div ref={sentinel} class="listContainer__sentinel" aria-hidden="true">
            <Show when={listStore.isLoadingMore}>
              <i class="ri-loader-3-line loading-spinner"></i>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}
