type AudioGraph = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  compressor: DynamicsCompressorNode;
  outputGain: GainNode;
  mode: 'direct' | 'normalized';
};

const graphs = new WeakMap<HTMLMediaElement, AudioGraph>();

function createGraph(audio: HTMLMediaElement): AudioGraph {
  const context = new AudioContext();
  const source = context.createMediaElementSource(audio);
  const compressor = context.createDynamicsCompressor();
  const outputGain = context.createGain();

  compressor.threshold.value = -24;
  compressor.knee.value = 24;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.25;
  outputGain.gain.value = 1.08;

  const graph = {
    context,
    source,
    compressor,
    outputGain,
    mode: 'direct' as const
  };

  source.connect(context.destination);

  audio.addEventListener('play', () => {
    if (context.state === 'suspended') {
      context.resume().catch(() => undefined);
    }
  });

  graphs.set(audio, graph);
  return graph;
}

function reconnect(graph: AudioGraph, normalized: boolean) {
  graph.source.disconnect();
  graph.compressor.disconnect();
  graph.outputGain.disconnect();

  if (normalized) {
    graph.source.connect(graph.compressor);
    graph.compressor.connect(graph.outputGain);
    graph.outputGain.connect(graph.context.destination);
    graph.mode = 'normalized';
  } else {
    graph.source.connect(graph.context.destination);
    graph.mode = 'direct';
  }
}

export function setStableVolumeNormalizer(audio: HTMLAudioElement, enabled: boolean) {
  let graph = graphs.get(audio);
  if (!graph && enabled) {
    try {
      graph = createGraph(audio);
    } catch (error) {
      console.warn('Audio normalizer unavailable', error);
      return;
    }
  }

  if (!graph) return;

  const nextMode = enabled ? 'normalized' : 'direct';
  if (graph.mode !== nextMode) reconnect(graph, enabled);

  if (enabled && graph.context.state === 'suspended') {
    graph.context.resume().catch(() => undefined);
  }
}
