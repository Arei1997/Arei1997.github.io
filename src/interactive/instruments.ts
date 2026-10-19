import { midiToFreq } from '../lib/audio';
import { playPiano } from './piano';

export type DrumId = 'kick' | 'snare' | 'clap' | 'hat' | 'openhat' | 'perc';
export type SynthId = 'pluck' | 'keys' | 'saw' | 'bass808';

let noise: AudioBuffer | null = null;

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** Percussive envelope: near-instant attack, exponential decay. */
function hit(param: AudioParam, t: number, peak: number, decay: number) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + 0.002);
  param.exponentialRampToValueAtTime(0.0001, t + decay);
}

function noiseHit(out: AudioNode, t: number, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number) {
  const ctx = out.context;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  hit(gain.gain, t, peak, decay);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.05);
  return gain;
}

function tone(out: AudioNode, t: number, type: OscillatorType, freq: number, peak: number, decay: number) {
  const ctx = out.context;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  hit(gain.gain, t, peak, decay);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + decay + 0.05);
  return osc;
}

/** Synthesised drum kit — no samples, so the whole studio stays a few kilobytes. */
export function playDrum(id: DrumId, t: number, out: AudioNode) {
  switch (id) {
    case 'kick': {
      const osc = tone(out, t, 'sine', 150, 1, 0.45);
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      noiseHit(out, t, 'highpass', 3000, 0.7, 0.15, 0.01);
      break;
    }
    case 'snare':
      noiseHit(out, t, 'bandpass', 1800, 0.8, 0.55, 0.18);
      tone(out, t, 'triangle', 190, 0.4, 0.1);
      break;
    case 'clap': {
      // A clap is several hands slightly out of sync: three quick bursts, then a tail.
      const gain = noiseHit(out, t, 'bandpass', 1100, 1.4, 0.6, 0.2);
      for (const dt of [0.011, 0.022]) {
        gain.gain.setValueAtTime(0.6, t + dt);
        gain.gain.exponentialRampToValueAtTime(0.15, t + dt + 0.009);
      }
      gain.gain.setValueAtTime(0.5, t + 0.031);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      break;
    }
    case 'hat':
      noiseHit(out, t, 'highpass', 7500, 0.7, 0.28, 0.05);
      break;
    case 'openhat':
      noiseHit(out, t, 'highpass', 7000, 0.7, 0.24, 0.32);
      break;
    case 'perc':
      tone(out, t, 'square', 540, 0.12, 0.12);
      tone(out, t, 'square', 800, 0.12, 0.12);
      break;
  }
}

export function playSynth(id: SynthId, midi: number, t: number, stepDur: number, out: AudioNode) {
  const ctx = out.context;
  switch (id) {
    case 'keys':
      playPiano(midi, 0.6, t, out);
      return;
    case 'pluck': {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 4;
      filter.frequency.setValueAtTime(5000, t);
      filter.frequency.exponentialRampToValueAtTime(350, t + 0.28);
      const gain = ctx.createGain();
      hit(gain.gain, t, 0.22, 0.45);
      filter.connect(gain).connect(out);
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToFreq(midi);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + 0.5);
      }
      return;
    }
    case 'saw': {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;
      filter.Q.value = 2;
      const gain = ctx.createGain();
      const end = t + stepDur * 0.9;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      gain.gain.setValueAtTime(0.16, end);
      gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.08);
      filter.connect(gain).connect(out);
      for (const detune of [-10, 10]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToFreq(midi);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(end + 0.1);
      }
      return;
    }
    case 'bass808': {
      // Two octaves down, with the characteristic downward pitch "drop" at the start.
      const freq = midiToFreq(midi - 24);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(freq * 2.2, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
      const drive = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 128 - 1) * 2.5);
      drive.curve = curve;
      const gain = ctx.createGain();
      hit(gain.gain, t, 0.55, 1.1);
      osc.connect(drive).connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + 1.2);
      return;
    }
  }
}
