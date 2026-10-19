import { audio } from '../lib/audio';

export const IDLE_RPM = 750;
export const REDLINE_RPM = 7500;

/** The looped buffer holds one engine cycle recorded at this speed; playbackRate scales it to any rpm. */
const REF_RPM = 1000;

// Mustang 5.0 "Coyote" firing order. Ford numbers cylinders 1–4 on the right bank, 5–8 on the left,
// so the banks fire R L R L L R L R — that uneven pattern per bank is the cross-plane V8 burble.
const FIRING_ORDER = [1, 5, 4, 8, 6, 3, 7, 2];

/** Seeded PRNG (mulberry32) so every visitor hears the same engine. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One four-stroke cycle (two crank revolutions) of exhaust pulses: a pressure thump plus a short
 * resonant ring per firing. Each bank gets its own level and ring pitch, and each cylinder a small
 * random variation — those differences produce the sub-harmonic lope you hear at idle.
 */
function buildCycle(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.round((sr * 120) / REF_RPM);
  const buffer = ctx.createBuffer(2, len, sr);
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  const rand = seeded(5);
  const slot = len / FIRING_ORDER.length;
  const pulseLen = Math.round(slot * 2.5);

  FIRING_ORDER.forEach((cyl, k) => {
    const leftBank = cyl >= 5;
    const amp = (leftBank ? 1 : 0.72) * (0.85 + rand() * 0.3);
    const ring = (leftBank ? 140 : 175) * (0.95 + rand() * 0.1);
    const start = Math.round(k * slot + (rand() - 0.5) * slot * 0.06);
    // Each bank exits on its own side, with a little bleed into the other channel.
    const [near, far] = leftBank ? [channels[0], channels[1]] : [channels[1], channels[0]];
    for (let n = 0; n < pulseLen; n++) {
      const t = n / sr;
      const thump = Math.exp(-t / 0.0045) * (1 - Math.exp(-t / 0.0005));
      const v = amp * (thump + 0.5 * Math.exp(-t / 0.007) * Math.sin(2 * Math.PI * ring * t));
      // Wrap around so the loop point is seamless.
      const i = (start + n) % len;
      near[i] += v;
      far[i] += v * 0.4;
    }
  });

  let peak = 0;
  for (const data of channels) {
    const mean = data.reduce((sum, v) => sum + v, 0) / len;
    for (let i = 0; i < len; i++) {
      data[i] -= mean;
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  for (const data of channels) for (let i = 0; i < len; i++) data[i] *= 0.9 / peak;
  return buffer;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export interface V8 {
  /** `load` is throttle: 1 on the gas, 0 coasting. */
  update(rpm: number, load: number, audible: boolean): void;
  /** Starter-motor whine while cranking. */
  crank(on: boolean): void;
  /** Exhaust pops and crackles on lift-off. */
  crackle(): void;
  stop(): void;
}

export function createV8(): V8 {
  const { ctx, master } = audio();
  const noise = noiseBuffer(ctx);

  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(master);

  const engine = ctx.createBufferSource();
  engine.buffer = buildCycle(ctx);
  engine.loop = true;
  engine.playbackRate.value = IDLE_RPM / REF_RPM;
  const drive = ctx.createWaveShaper();
  const curve = new Float32Array(512);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 256 - 1) * 2.2);
  drive.curve = curve;
  const body = ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.Q.value = 0.8;
  const chest = ctx.createBiquadFilter();
  chest.type = 'peaking';
  chest.frequency.value = 110;
  chest.Q.value = 1;
  chest.gain.value = 7;
  engine.connect(drive).connect(body).connect(chest).connect(out);

  const roarSrc = ctx.createBufferSource();
  roarSrc.buffer = noise;
  roarSrc.loop = true;
  const roar = ctx.createBiquadFilter();
  roar.type = 'bandpass';
  roar.Q.value = 0.7;
  const roarGain = ctx.createGain();
  roarGain.gain.value = 0;
  roarSrc.connect(roar).connect(roarGain).connect(out);

  const starter = ctx.createOscillator();
  starter.type = 'sawtooth';
  starter.frequency.value = 380;
  const starterTone = ctx.createBiquadFilter();
  starterTone.type = 'bandpass';
  starterTone.frequency.value = 900;
  starterTone.Q.value = 2;
  const starterGain = ctx.createGain();
  starterGain.gain.value = 0;
  starter.connect(starterTone).connect(starterGain).connect(out);

  engine.start();
  roarSrc.start();
  starter.start();

  return {
    update(rpm, load, audible) {
      const t = ctx.currentTime;
      // Lumpy idle: revs wander a little near idle, smoothing out as they climb.
      const lope = Math.max(0, 1 - (rpm - IDLE_RPM) / 800) * (Math.sin(t * 9.5) * 25 + Math.sin(t * 3.1) * 30);
      engine.playbackRate.setTargetAtTime(Math.max(0.1, (rpm + lope) / REF_RPM), t, 0.015);
      body.frequency.setTargetAtTime(350 + rpm * (0.3 + load * 0.25), t, 0.04);
      roar.frequency.setTargetAtTime(700 + rpm * 0.3, t, 0.05);
      roarGain.gain.setTargetAtTime(audible ? load * (rpm / REDLINE_RPM) * 0.22 : 0, t, 0.06);
      out.gain.setTargetAtTime(audible ? 0.22 + load * 0.12 : 0, t, audible ? 0.03 : 0.35);
    },
    crank(on) {
      starterGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.03);
    },
    crackle() {
      const now = ctx.currentTime;
      const pops = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < pops; k++) {
        const at = now + 0.08 + Math.random() * 0.8;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const tone = ctx.createBiquadFilter();
        tone.type = 'bandpass';
        tone.frequency.value = 900 + Math.random() * 1500;
        tone.Q.value = 1.2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.35, at + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.02 + Math.random() * 0.03);
        src.connect(tone).connect(g).connect(master);
        src.start(at, Math.random() * 1.5, 0.08);
      }
    },
    stop() {
      const t = ctx.currentTime;
      out.gain.setTargetAtTime(0, t, 0.05);
      [engine, roarSrc, starter].forEach((node) => node.stop(t + 0.3));
    },
  };
}
