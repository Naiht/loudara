import { For } from 'solid-js';
import { navStore, setNavStore, t, getList } from '@stores';
import { drawer, fetchCollection, setDrawer } from '@utils';

type SidebarItem = {
  id: 'search' | 'library' | 'list' | 'queue' | 'settings';
  icon: string;
  label: TranslationKeys;
};

type SidebarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
};

const items: SidebarItem[] = [
  { id: 'search', icon: 'ri-search-2-line', label: 'nav_search' },
  { id: 'library', icon: 'ri-archive-stack-line', label: 'nav_library' },
  { id: 'list', icon: 'ri-list-check-2', label: 'nav_list' },
  { id: 'queue', icon: 'ri-order-play-fill', label: 'nav_queue' },
  { id: 'settings', icon: 'ri-list-settings-line', label: 'nav_settings' }
];

export default function Sidebar(props: SidebarProps) {
  function openMainFeature(id: SidebarItem['id']) {
    setNavStore('queue', 'state', false);
    setNavStore('player', 'state', false);

    if (id === 'queue') {
      setNavStore('queue', 'state', true);
      return;
    }

    if (id === 'list' && drawer.lastList) {
      const { id: listId, type, shared } = drawer.lastList;
      if (type === 'collection') fetchCollection(listId, shared);
      else getList(listId, type as any);
      return;
    }

    setNavStore('active', id);
    if (id === 'search' || id === 'library') setDrawer('lastMainFeature', id);
  }

  return (
    <aside
      aria-label="Primary navigation"
      class="app-sidebar"
    >
      <button
        aria-label={props.collapsed ? 'Expandir menu' : 'Ocultar menu'}
        class="app-sidebar__toggle"
        type="button"
        onClick={props.onToggleSidebar}
      >
        <i class={props.collapsed ? 'ri-play-list-add-fill' : 'ri-close-large-line'} aria-hidden="true" />
        <span>{props.collapsed ? 'Expandir' : 'Ocultar'}</span>
      </button>

      <nav class="app-sidebar__nav">
        <For each={items}>
          {item => (
            <button
              aria-label={t(item.label)}
              class="app-sidebar__item"
              classList={{ 'is-active': item.id === 'queue' ? navStore.queue.state : navStore.active === item.id && !navStore.queue.state && !navStore.player.state }}
              type="button"
              onClick={() => openMainFeature(item.id)}
            >
              <i class={item.icon} aria-hidden="true" />
              <span class="app-sidebar__label">{t(item.label)}</span>
            </button>
          )}
        </For>
      </nav>
    </aside>
  );
}
