import { onMount, createEffect, For, createSignal, Show } from "solid-js";
import './Settings.css';
import { setNavStore, t, setStore, updateLang } from '@stores';
import { Selector } from '@components/Selector.tsx';
import { Button, Input } from '../../ui/components';
import { platform } from '@platform';
import { getInvalidYoutubeSessionValueReason } from '@platform/web/streamingCredentials';
import { config, setConfig, drawer, setDrawer, themer, quickSwitch, deleteCollection, getCollection, streamCache } from '@utils';
import Dropdown from "./Dropdown";

export default function() {
  let settingsSection!: HTMLDivElement;
  const isPWA = matchMedia('(display-mode: standalone)').matches;
  const [youtubeCookie, setYoutubeCookie] = createSignal('');
  const [hasYoutubeSession, setHasYoutubeSession] = createSignal(false);

  onMount(() => {
    setNavStore('settings', 'ref', settingsSection);
    settingsSection.scrollIntoView();

    void platform.streamingCredentials.get().then(credentials => {
      if (!credentials) return;
      setYoutubeCookie(credentials.cookie);
      setHasYoutubeSession(Boolean(credentials.cookie));
    });
  });

  createEffect(updateLang);

  async function saveYoutubeSession(event: SubmitEvent) {
    event.preventDefault();
    const credentials = {
      cookie: youtubeCookie().trim(),
      visitorData: '',
      poToken: ''
    };

    if (!credentials.cookie) {
      setStore('snackbar', {
        message: t('settings_youtube_session_empty'),
        type: 'warning'
      });
      return;
    }

    const invalidReason = getInvalidYoutubeSessionValueReason(credentials);
    if (invalidReason) {
      setStore('snackbar', {
        message: t(invalidReason === 'truncated'
          ? 'settings_youtube_session_truncated'
          : 'settings_youtube_session_invalid_header'),
        type: 'error'
      });
      return;
    }

    await platform.streamingCredentials.set(credentials);
    streamCache.clear();
    setHasYoutubeSession(true);
    setStore('snackbar', {
      message: t('settings_youtube_session_saved'),
      type: 'success'
    });
  }

  async function removeYoutubeSession() {
    await platform.streamingCredentials.remove();
    streamCache.clear();
    setYoutubeCookie('');
    setHasYoutubeSession(false);
    setStore('snackbar', {
      message: t('settings_youtube_session_removed'),
      type: 'info'
    });
  }

  const Toggle = (props: { name: string, checked: boolean, onclick: (e: MouseEvent) => void }) => {
    const [checked, setChecked] = createSignal(props.checked);

    return (
      <span
        role="checkbox"
        aria-checked={checked()}
        tabindex="0"
        onclick={(e) => {
          props.onclick(e);
          setChecked(props.checked);
        }}
        onkeydown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            props.onclick(e as unknown as MouseEvent);
            setChecked(!props.checked);
          }
        }}
      >
        <label>{t(props.name as TranslationKeys)}</label>
        <i class={checked() ? 'ri-toggle-fill' : 'ri-toggle-line'}></i>
      </span>
    );
  };

  return (
    <section
      ref={settingsSection}
      class="settingsSection"
    >
      <header>
        <p>Loudara {Build}</p>
        <i
          aria-label={t('close')}
          class="ri-close-large-line" onclick={() => setNavStore('active', drawer.lastMainFeature as 'search' | 'library')}></i>
        <Dropdown />
      </header>
      <div>
        {/* App Settings */}
        <Selector
          label='settings_language'
          id='languageSelector'
          onchange={(e) => {
            setConfig('language', e.target.value);
            setStore('locale', e.target.value);
            setStore('snackbar', t('settings_reload'));
          }}
          value={document.documentElement.lang}
        >
          <For each={Locales}>
            {(item) => (
              <option value={item}>{new Intl.DisplayNames(document.documentElement.lang, { type: 'language' }).of(item)}</option>
            )}
          </For>
        </Selector>

        <Show when={isPWA}>
          <Selector
            id='shareAction'
            label='settings_pwa_share_action'
            onchange={(e) => {
              setConfig('shareAction', e.target.value as 'play' | 'watch' | 'download');
            }}
            value={config.shareAction}
          >
            <option value='play'>{t('player_play_button')}</option>
            <option value='watch'>{t('settings_pwa_watch')}</option>
            <option value='dl'>{t('actions_menu_download')}</option>
          </Selector>
        </Show>

        {/* Playback Settings */}
        <Selector
          label='settings_audio_quality'
          id='qualityPreference'
          onchange={async (e) => {
            setConfig('quality', e.target.value as 'worst' | 'low' | 'medium' | 'high');
            quickSwitch();
          }}
          value={config.quality}
        >
          <option value="worst">{t('settings_quality_worst')}</option>
          <option value="low">{t('settings_quality_low')}</option>
          <option value="medium">{t('settings_quality_medium')}</option>
          <option value="high">{t('settings_quality_high')}</option>
        </Selector>

        <Toggle
          name='settings_stable_volume'
          checked={Boolean(config.stableVolume)}
          onclick={() => {
            setConfig('stableVolume', !config.stableVolume);
            quickSwitch();
          }}
        />

        {/*<Toggle
          name='settings_watchmode'
          checked={Boolean(config.watchMode)}
          onclick={() => {
            setConfig('watchMode',
              config.watchMode ?
                '' : '144p'
            );
          }}
        />*/}

        {/* Library Settings */}
        <Toggle
          name='settings_store_discoveries'
          checked={config.discover}
          onclick={() => {
            let configVal = !config.discover;
            if (!configVal) {
              const count = drawer.discovery?.length || 0;
              if (confirm(t("settings_clear_discoveries", count.toString()))) {
                setDrawer('discovery', []);
                configVal = false;
              }
              else return;
            }
            setConfig('discover', configVal);
          }}
        />

        <Toggle
          name='settings_store_history'
          checked={config.history}
          onclick={() => {
            let configVal = !config.history;
            if (!configVal) {
              const db = getCollection('history') || [];
              const count = db.length;
              if (confirm(t("settings_clear_history", count.toString()))) {
                deleteCollection('history');
                configVal = false;
              } else return;
            }
            setConfig('history', configVal);
          }}
        />


        {/* Search Settings */}
        <Toggle
          name='settings_link_capturing'
          checked={config.searchBarLinkCapture}
          onclick={() => {
            setConfig('searchBarLinkCapture', !config.searchBarLinkCapture);
          }}
        />

        <Toggle
          name='settings_display_suggestions'
          checked={config.searchSuggestions}
          onclick={() => {
            setConfig('searchSuggestions', !config.searchSuggestions);
            setStore('snackbar', t('settings_reload'));
          }}
        />

        <Toggle
          name='settings_save_recent_searches'
          checked={config.saveRecentSearches}
          onclick={() => {
            setConfig('saveRecentSearches', !config.saveRecentSearches);
          }}
        />

        {/* Personalize Settings */}
        <Toggle
          name='settings_load_images'
          checked={config.loadImage}
          onclick={() => {
            setConfig('loadImage', !config.loadImage);
            setStore('snackbar', t('settings_reload'));
          }}
        />

        <Selector
          label='settings_theming_scheme'
          id='themeSelector'
          onchange={(e) => {
            themer();
            setConfig('theme', e.target.value as 'auto' | 'light' | 'dark');
          }}
          value={config.theme}
        >
          <option value="auto" selected>{t('settings_theming_scheme_system')}</option>
          <option value="light">{t('settings_theming_scheme_light')}</option>
          <option value="dark">{t('settings_theming_scheme_dark')}</option>
        </Selector>

        <section class="settings-session">
          <div class="settings-session__heading">
            <span class="settings-session__icon" aria-hidden="true">
              <i class="ri-key-2-line"></i>
            </span>
            <div>
              <h2>{t('settings_youtube_session')}</h2>
              <span
                class="settings-session__status"
                classList={{ 'settings-session__status--active': hasYoutubeSession() }}
              >
                {t(hasYoutubeSession()
                  ? 'settings_youtube_session_active'
                  : 'settings_youtube_session_inactive')}
              </span>
            </div>
          </div>

          <form class="settings-session__form" onsubmit={saveYoutubeSession}>
            <Input
              id="youtubeCookie"
              type="password"
              autocomplete="off"
              spellcheck={false}
              label={t('settings_youtube_cookie')}
              value={youtubeCookie()}
              oninput={(event) => setYoutubeCookie(event.currentTarget.value)}
            />

            <div class="settings-session__actions">
              <Show when={hasYoutubeSession()}>
                <Button type="button" variant="secondary" onclick={removeYoutubeSession}>
                  <i class="ri-delete-bin-6-line" aria-hidden="true"></i>
                  {t('settings_youtube_session_remove')}
                </Button>
              </Show>
              <Button type="submit">
                <i class="ri-save-3-line" aria-hidden="true"></i>
                {t('settings_youtube_session_save')}
              </Button>
            </div>
          </form>
        </section>
      </div>
      <br />
      <br />
    </section >
  );
}
