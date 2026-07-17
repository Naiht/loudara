import { playerStore, setPlayerStore, setStore } from "@stores";
import { config, convertSStoHHMMSS } from "@utils";
import { isQueuePrefetchActive } from "../modules/queuePrefetch";
import type { StreamData } from "@core/streaming";

let playerAbortController: AbortController;
export async function player(id?: string) {

  if (playerAbortController)
    playerAbortController.abort();

  playerAbortController = new AbortController();

  if (!id) return;

  const enforceVideo = !playerStore.isMusic && playerStore.isWatching;

  if (!enforceVideo)
    setPlayerStore({
      playbackState: 'loading',
      status: 'Loading Audio...'
    });

  const getStreamData = await import('@modules/getStreamData').then(mod => mod.default);
  const data = await getStreamData(id, playerAbortController.signal);

  if (data && 'streams' in data)
    setPlayerStore({
      data,
      fullDuration: data.duration || 0
    });
  else {
    const errorData = data as Record<'error' | 'message', string>;
    setPlayerStore({
      playbackState: 'none',
      status: errorData.message || errorData.error || 'Loading Audio Failed'
    });
    setStore('snackbar', {
      message: playerStore.status,
      type: 'error'
    });
    return;
  }

  const streamData = data as StreamData;

  await import('../modules/setMetadata')
    .then(mod => mod.default({
      id,
      title: streamData.title || playerStore.stream.title,
      author: streamData.author || playerStore.stream.author,
      duration: convertSStoHHMMSS(streamData.duration || 0),
      authorId: streamData.authorId || playerStore.stream.authorId,
      img: playerStore.stream.img
    }));

  import('../modules/setAudioStreams')
    .then(mod => mod.default(streamData.streams));


  if (config.similarContent && !enforceVideo && !isQueuePrefetchActive())
    import('../modules/enqueueRelatedStreams')
      .then(mod => mod.default(streamData.recommended || []));



  // related streams imported into discovery after 1min 40seconds, short streams are naturally filtered out

  if (config.discover)
    import('../modules/setDiscoveries')
      .then(mod => {
        setTimeout(() => {
          mod.default(id, streamData.recommended || []);
        }, 1e5);
      });

}
