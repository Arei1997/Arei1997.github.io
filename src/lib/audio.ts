export interface AudioGraph {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;
}

let graph: AudioGraph | null = null;

/**
 * Shared audio graph: everything routes through master → compressor → analyser → speakers.
 * Browsers only allow audio after a user gesture, so call this from an input handler.
 */
export function audio(): AudioGraph {
  if (!graph) {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    master.connect(compressor).connect(analyser).connect(ctx.destination);
    graph = { ctx, master, analyser };
  }
  if (graph.ctx.state === 'suspended') void graph.ctx.resume();
  return graph;
}

/** The audio graph if the user has already unlocked sound; never creates one. */
export function audioIfReady(): AudioGraph | null {
  return graph && graph.ctx.state === 'running' ? graph : null;
}

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
