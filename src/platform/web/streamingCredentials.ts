import type {
  StreamingCredentials,
  StreamingCredentialsPort
} from '../contracts';

const STORAGE_KEY = 'loudara_youtube_session';

function isValidHeaderValue(value: string) {
  for (let index = 0; index < value.length; index++) {
    const charCode = value.charCodeAt(index);
    if (charCode > 255 || charCode === 10 || charCode === 13) return false;
  }

  return true;
}

function hasTruncatedValue(value: string) {
  return value.includes('...') || value.includes('…');
}

export function getInvalidYoutubeSessionValueReason(credentials: StreamingCredentials): string | undefined {
  const values = [
    credentials.cookie,
    credentials.visitorData,
    credentials.poToken
  ];

  if (values.some(hasTruncatedValue)) return 'truncated';
  if (values.some(value => value && !isValidHeaderValue(value))) return 'invalid_header_value';
  return undefined;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) return null;

  try {
    const testKey = '__loudara_session_test__';
    window.sessionStorage.setItem(testKey, testKey);
    window.sessionStorage.removeItem(testKey);
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeCredentials(credentials: StreamingCredentials): StreamingCredentials {
  return {
    cookie: credentials.cookie.trim(),
    visitorData: credentials.visitorData.trim(),
    poToken: credentials.poToken.trim()
  };
}

export const webStreamingCredentials: StreamingCredentialsPort = {
  async get(): Promise<StreamingCredentials | null> {
    const storage = getSessionStorage();
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const credentials = normalizeCredentials(JSON.parse(raw) as StreamingCredentials);
      if (getInvalidYoutubeSessionValueReason(credentials)) {
        storage?.removeItem(STORAGE_KEY);
        return null;
      }

      return credentials;
    } catch {
      storage?.removeItem(STORAGE_KEY);
      return null;
    }
  },

  async set(credentials: StreamingCredentials): Promise<void> {
    const normalizedCredentials = normalizeCredentials(credentials);
    if (getInvalidYoutubeSessionValueReason(normalizedCredentials)) {
      throw new Error('Invalid YouTube session value');
    }

    getSessionStorage()?.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizedCredentials)
    );
  },

  async remove(): Promise<void> {
    getSessionStorage()?.removeItem(STORAGE_KEY);
  }
};

export async function getYoutubeSessionHeaders(): Promise<Record<string, string>> {
  const credentials = await webStreamingCredentials.get();
  if (!credentials) return {};

  const headers: Record<string, string> = {};
  if (credentials.cookie) headers['X-Loudara-Youtube-Cookie'] = credentials.cookie;
  if (credentials.visitorData) headers['X-Loudara-Youtube-Visitor-Data'] = credentials.visitorData;
  if (credentials.poToken) headers['X-Loudara-Youtube-Po-Token'] = credentials.poToken;
  return headers;
}
