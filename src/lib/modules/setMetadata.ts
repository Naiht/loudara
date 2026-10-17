import { playerStore, setPlayerStore } from "@stores";
import { config, createFallbackArtworkUrl, getArtworkCandidates } from "@utils";
import { isNativeApp } from "@platform/native";

export default async function(data: TrackItem) {

  setPlayerStore('stream', data);

  // remove ' - Topic' from author name if it exists

  let music = false;
  let authorText = playerStore.stream.author || '';
  if (data.author?.endsWith(' - Topic')) {
    music = true;
    authorText = data.author.slice(0, -8);
  }

  setPlayerStore('isMusic', music);

  const metadataObj: MediaMetadataInit = {
    title: data.title,
    artist: authorText,
    album: playerStore.context.src
  };

  const artworkSource = data.img || data.id;
  const [img] = getArtworkCandidates(artworkSource, data.id, data.title, 'maxres');
  if (config.loadImage) {
    if (playerStore.mediaArtworkSource !== artworkSource || playerStore.mediaArtworkTrackId !== data.id) {
      setPlayerStore({
        mediaArtwork: img,
        mediaArtworkSource: artworkSource,
        mediaArtworkTrackId: data.id,
        mediaArtworkFallback: false
      });
    }

    metadataObj.artwork = [
      { src: img, sizes: '96x96' },
      { src: img, sizes: '128x128' },
      { src: img, sizes: '192x192' },
      { src: img, sizes: '256x256' },
      { src: img, sizes: '384x384' },
      { src: img, sizes: '512x512' },
    ]
  }
  else {
    setPlayerStore({
      mediaArtwork: createFallbackArtworkUrl(data.title),
      mediaArtworkSource: '',
      mediaArtworkTrackId: data.id,
      mediaArtworkFallback: false
    });
  }

  document.title = data.title + ' - Loudara';


  if ('mediaSession' in navigator) {
    if (isNativeApp && !playerStore.isWatching) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    } else {
      import('@modules/mediaSession').then(m => {
        if (playerStore.stream.id !== data.id || (isNativeApp && !playerStore.isWatching)) return;
        m.updateMediaSessionPosition();
        navigator.mediaSession.metadata = new MediaMetadata(metadataObj);
      });
    }
  }

}
