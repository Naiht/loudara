import { playerStore } from "@stores";
import { convertSStoHHMMSS, getCollection } from "@utils";
import { drawer, setDrawer } from "@utils";
import type { RecommendedStream } from "@core/streaming";

export default function(
  id: string,
  relatedStreams: RecommendedStream[]
) {
  if (id !== playerStore.stream.id) return;

  const discovery = [...(drawer.discovery || [])];

  relatedStreams?.forEach(
    stream => {
      if (
        stream.duration < 100 || stream.duration > 3000) return;

      const rsId = stream.videoId;

      const existingItem = discovery.find(item => item.id === rsId);

      if (existingItem) {
        existingItem.frequency++;
      } else {
        discovery.push({
          id: rsId,
          title: stream.title,
          author: stream.author,
          duration: convertSStoHHMMSS(stream.duration),
          authorId: stream.authorId || '',
          type: 'video' as const,
          frequency: 1
        });
      }
    });

  // Randomize Array
  for (let i = discovery.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [discovery[i], discovery[j]] = [discovery[j], discovery[i]];
  }

  // remove if exists in history
  const history = getCollection('history');
  const filteredDiscovery = discovery.filter(e => !history.includes(e.id));

  // randomly remove items from array when limit crossed
  let len = filteredDiscovery.length;
  while (len > 256) {
    const i = Math.floor(Math.random() * len)
    filteredDiscovery.splice(i, 1);
    len--;
  }

  // insert the upgraded collection to discover;
  setDrawer('discovery', filteredDiscovery);

}
