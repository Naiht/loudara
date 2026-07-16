import { clearLibraryData, exportLibraryData, getTracksMap, importLibraryData, setConfig, config } from '@utils';
import { setStore, t } from '@stores';
import { lazy, Show } from 'solid-js';
import { render } from 'solid-js/web';

const Login = lazy(() => import('@components/Login'));

export default function Dropdown() {

  async function importLibrary(e: Event) {
    const importBtn = e.target as HTMLInputElement & { files: FileList };
    const importedData = JSON.parse(await importBtn.files[0].text());

    if (importLibraryData(importedData) === 'v2') {
      setStore('snackbar', t('library_imported')); // Reusing existing translation key
      location.reload();
    } else {
      setStore('snackbar', t('library_migration_v1_v2'));
      location.reload(); // Trigger migration
    }
  };

  function exportLibrary() {
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.download = `loudara_library_${date}.json`;

    const exportedData = exportLibraryData();

    link.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportedData, undefined, 2))}`;
    link.click();
  };

  function cleanLibrary() {
    // Count items in V2 library
    let count = 0;
    const tracksMap = getTracksMap();
    count = Object.keys(tracksMap).length;

    if (confirm(t('library_clean_prompt', count.toString()))) {
      clearLibraryData();
      location.reload();
    }
  };

  return (
    <details>
      <summary><i
        aria-label="More Options"
        class="ri-more-2-fill"
      ></i></summary>
      <ul>
        <li onclick={() => document.getElementById('upload_loudara')?.click()}>
          <label>
            <i class="ri-import-line"></i>&nbsp;{t('library_import')}
          </label>
          <input type="file" id="upload_loudara" onchange={importLibrary} />
        </li>
        <li id="exportBtn" onclick={exportLibrary}>
          <i class="ri-export-line"></i>&nbsp;{t('library_export')}

        </li>
        <li id="cleanLibraryBtn" onclick={cleanLibrary}>
          <i class="ri-delete-bin-2-line"></i>&nbsp;{t('library_clean')}
        </li>

        <li onclick={() => document.getElementById('upload_songshift')?.click()}>
          <label>
            <i class="ri-refresh-line"></i>&nbsp;Import Playlists from SongShift
          </label>
          <input type="file" id="upload_songshift" onchange={async (e) => (await import('@modules/importSongshiftStreams')).default(e.target.files![0])} />
        </li>

        <Show when={config.dbsync}
          fallback={
            <li onclick={() => {
              render(() => <Login />, document.body);
            }}>
              <i class="ri-cloud-fill"></i>&nbsp;Cloud Sync
            </li>
          }>
          <li onclick={() => {
            setConfig('dbsync', '');
            location.reload();
          }}>
            <i class="ri-cloud-fill"></i>&nbsp;Logout
          </li>
        </Show>
      </ul>
    </details >
  )
}
