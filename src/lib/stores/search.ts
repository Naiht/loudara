import { createStore } from 'solid-js/store';
import { config, drawer, setDrawer } from '@utils';
import { updateParam, setStore, store } from '@stores';
import { getEmbeddedSearchResults, getEmbeddedSearchSuggestions, hasEmbeddedBackend } from '@platform/embedded';

type SearchResultPage = {
  items: (YTItem | YTListItem)[];
  hasMore: boolean;
};

const createInitialState = () => ({
  query: '',
  results: [] as (YTItem | YTListItem)[],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  page: 1,
  suggestions: {
    data: [] as string[],
    index: -1,
    controller: new AbortController()
  },
  observer: { disconnect() { } } as IntersectionObserver
});

export const [searchStore, setSearchStore] = createStore(createInitialState());

let suggestionTimeout: ReturnType<typeof setTimeout> | undefined;
let lastQuery = '';
const DEBOUNCE_TIME = 400;
const MIN_INITIAL_RESULTS = 18;

function normalizeSearchPayload(payload: SearchResultPage | (YTItem | YTListItem)[]): SearchResultPage {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      hasMore: false
    };
  }

  return {
    items: payload.items || [],
    hasMore: Boolean(payload.hasMore)
  };
}

function mergeUniqueItems(current: (YTItem | YTListItem)[], next: (YTItem | YTListItem)[]) {
  const seen = new Set(current.map((item) => `${item.type}:${item.id}`));

  return [
    ...current,
    ...next.filter((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  ];
}

export function resetSearch() {
  searchStore.observer.disconnect();
  setSearchStore(createInitialState());
  updateParam('q');
  updateParam('f');
}

export function getSearchSuggestions(text: string) {
  searchStore.suggestions.controller.abort();
  clearTimeout(suggestionTimeout);

  if (text.length < 3) {
    setSearchStore('suggestions', 'data', []);
    lastQuery = '';
    return;
  }

  if (text === lastQuery) return;

  suggestionTimeout = setTimeout(() => {
    lastQuery = text;
    setSearchStore('page', 1);
    setSearchStore('suggestions', 'index', -1);

    const newController = new AbortController();
    setSearchStore('suggestions', 'controller', newController);

    const isMusic = ['song', 'artist', 'album'].includes(config.searchFilter);
    const request = hasEmbeddedBackend
      ? getEmbeddedSearchSuggestions(text, isMusic)
      : fetch(`${store.api}/search-suggestions?q=${encodeURIComponent(text)}&music=${isMusic}`, { signal: newController.signal })
        .then(res => {
          if (!res.ok) throw new Error('Could not load search suggestions');
          return res.json() as Promise<string[]>;
        });

    request
      .then(data => {
        if (newController.signal.aborted || searchStore.query !== text) return;
        setSearchStore('suggestions', 'data', data);
      })
      .catch(e => {
        if (e.name === 'AbortError') return;
        setStore('snackbar', e.message);
        setSearchStore('suggestions', 'data', []);
      });
  }, DEBOUNCE_TIME);
}

export async function getSearchResults(options: boolean | { force?: boolean, append?: boolean } = false) {
  const force = typeof options === 'boolean' ? options : Boolean(options.force);
  const append = typeof options === 'object' ? Boolean(options.append) : false;
  const { query, results, isLoading, isLoadingMore, hasMore, page } = searchStore;
  const { searchFilter } = config;

  if (!query || ((isLoading || isLoadingMore) && !force)) return;
  if (append && !hasMore) return;
  if (!append && !force && results.length > 0) return;

  const nextPage = append ? page + 1 : 1;

  setSearchStore(append ? 'isLoadingMore' : 'isLoading', true);

  if (!append) {
    clearTimeout(suggestionTimeout);
    lastQuery = '';
    searchStore.suggestions.controller.abort();
    setSearchStore('suggestions', 'data', []);
    setSearchStore('hasMore', true);
    searchStore.observer.disconnect();
  }

  const { recentSearches } = drawer;
  const lc = query.trim().toLowerCase();

  if (config.saveRecentSearches && lc && !lc.includes(' ') && !lc.includes(',')) {
    if (recentSearches.includes(lc)) {
      recentSearches.splice(recentSearches.indexOf(lc), 1);
    }
    recentSearches.push(lc);

    while (recentSearches.length > 7)
      recentSearches.shift();

    setDrawer('recentSearches', recentSearches);
  }

  if (!append) {
    updateParam('q', query);
    updateParam('f', searchFilter === 'all' ? '' : searchFilter);
  }

  try {
    const data = hasEmbeddedBackend
      ? await getEmbeddedSearchResults({ q: query, f: searchFilter, page: nextPage })
      : await fetch(`${store.api}/search?q=${encodeURIComponent(query)}&f=${searchFilter}&page=${nextPage}`)
        .then(res => {
          if (!res.ok) throw new Error('Could not load search results');
          return res.json() as Promise<SearchResultPage | (YTItem | YTListItem)[]>;
        });

    const payload = normalizeSearchPayload(data);

    setSearchStore('page', nextPage);
    setSearchStore('hasMore', payload.hasMore && payload.items.length > 0);
    setSearchStore('results', (current) => append ? mergeUniqueItems(current, payload.items) : payload.items);

    if (!append && payload.items.length < MIN_INITIAL_RESULTS && payload.hasMore) {
      setTimeout(() => getSearchResults({ append: true }), 0);
    }
  } catch (e) {
    setStore('snackbar', e instanceof Error ? e.message : 'Could not load search results');
    if (!append) {
      setSearchStore('results', []);
    }
    setSearchStore('hasMore', false);
  } finally {
    setSearchStore(append ? 'isLoadingMore' : 'isLoading', false);
  }
}
