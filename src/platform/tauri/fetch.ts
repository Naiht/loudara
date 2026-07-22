import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntimeAvailable } from './index';

type TauriHttpFetchResponse = {
  status: number;
  headers: Record<string, string>;
  body: number[];
};

async function requestToTauriFetchInput(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) return input;
  return new Request(input, init);
}

export async function tauriFetch(input: RequestInfo | URL, init?: RequestInit) {
  const request = await requestToTauriFetchInput(input, init);
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body: number[] | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const bodyBytes = new Uint8Array(await request.clone().arrayBuffer());
    if (bodyBytes.byteLength > 0) {
      body = Array.from(bodyBytes);
    }
  }

  const response = await invoke<TauriHttpFetchResponse>('http_fetch', {
    url: request.url,
    method: request.method,
    headers,
    body
  });

  return new Response(new Uint8Array(response.body), {
    status: response.status,
    headers: new Headers(response.headers)
  });
}

export function getRuntimeFetch() {
  return isTauriRuntimeAvailable() ? tauriFetch : fetch.bind(globalThis);
}
