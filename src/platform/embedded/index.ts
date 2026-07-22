import {
  getNativeGallery,
  getNativeListData,
  getNativeSearchResults,
  getNativeSearchSuggestions,
  getNativeSimilar,
  getNativeStreamData,
  getNativeSubfeed,
  getNativeTrending,
  isNativeApp
} from '../native';
import { isTauriRuntimeAvailable } from '../tauri';

export const hasEmbeddedBackend = isNativeApp || isTauriRuntimeAvailable();

export const getEmbeddedSearchSuggestions = getNativeSearchSuggestions;
export const getEmbeddedSearchResults = getNativeSearchResults;
export const getEmbeddedListData = getNativeListData;
export const getEmbeddedTrending = getNativeTrending;
export const getEmbeddedSubfeed = getNativeSubfeed;
export const getEmbeddedGallery = getNativeGallery;
export const getEmbeddedSimilar = getNativeSimilar;
export const getEmbeddedStreamData = getNativeStreamData;
