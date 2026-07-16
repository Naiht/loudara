import { DEFAULT_INVIDIOUS_INSTANCES } from '@core/streaming/invidiousInstances';

export function getInvidiousInstances(): string[] {
  const configured = import.meta.env.VITE_INVIDIOUS_INSTANCES;
  if (!configured) return DEFAULT_INVIDIOUS_INSTANCES;

  const instances = configured
    .split(',')
    .map((instance: string) => instance.trim())
    .filter(Boolean);

  return instances.length ? instances : DEFAULT_INVIDIOUS_INSTANCES;
}
