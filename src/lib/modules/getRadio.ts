import { store } from '@stores';
import { getEmbeddedSimilar, hasEmbeddedBackend } from '@platform/embedded';

export default async function(seed: TrackItem): Promise<TrackItem[]> {
  const title = seed.title;
  const artist = seed.author?.replace(/\s*-\s*Topic$/, '') || '';

  if (!title || !artist) {
    throw new Error('No hay suficiente informacion para iniciar radio');
  }

  const data = hasEmbeddedBackend
    ? await getEmbeddedSimilar({ title, artist, limit: '25' })
    : await fetch(`${store.api}/similar?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&limit=25`)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo iniciar radio');
        return res.json() as Promise<TrackItem[]>;
      });

  return data.filter(item => item.id !== seed.id);
}
