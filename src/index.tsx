/* @refresh reload */

import { lazy, onMount, Show } from 'solid-js';
import { Portal, render } from 'solid-js/web';
import { themer, syncLibrary } from '@utils';
import { updateLang, setStore, store, navStore } from '@stores';
import { requestRequiredPermissions } from '@platform/native';
import { initNavigationHistory, useNavigationHistory } from '@modules/navigationHistory';
import AppShell from './layouts/AppShell';
import './styles/global.css';
import 'remixicon/fonts/remixicon.css';

updateLang().then(() => {
  themer();

  render(() => (
    <App />
  ), document.body);
});


const ActionsMenu = lazy(() => import('@components/ActionsMenu'));
const SnackBar = lazy(() => import('@components/SnackBar'));

export default function App() {

  useNavigationHistory();

  onMount(async () => {
    await requestRequiredPermissions();
    await import('@modules/start.ts').then(mod => mod.default());
    initNavigationHistory();

    setStore('syncState', 'synced');
    syncLibrary('init');
  });

  const Search = navStore.search.component;
  const Library = navStore.library.component;
  const List = navStore.list.component;
  const Settings = navStore.settings.component;
  const Queue = navStore.queue.component;
  const Player = navStore.player.component;

  return (
    <AppShell>
      <Show when={navStore.queue.state && !navStore.player.state}>
        <Queue />
      </Show>

      <Show when={navStore.player.state}>
        <Player />
      </Show>

      <Show when={!navStore.queue.state && !navStore.player.state}>
        <Show when={navStore.active === 'search'}><Search /></Show>
        <Show when={navStore.active === 'library'}><Library /></Show>
        <Show when={navStore.active === 'list'}><List /></Show>
        <Show when={navStore.active === 'settings'}><Settings /></Show>
      </Show>

      <Show when={store.snackbar}>
        <SnackBar />
      </Show>
      <Portal>
        <Show when={store.actionsMenu?.id}>
          <ActionsMenu />
        </Show>
      </Portal>
    </AppShell>
  );
}
