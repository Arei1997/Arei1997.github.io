import { audio, midiToFreq } from '../lib/audio';

// Strings in tab order: high E at the top, low E at the bottom.
const OPEN = [64, 59, 55, 50, 45, 40];
const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

// Frets written the way guitarists read them: low E → high E. -1 = muted.
const CHORDS: Record<string, number[]> = {
  Open: [0, 0, 0, 0, 0, 0],
  C: [-1, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  D: [-1, -1, 0, 2, 3, 2],
  Am: [-1, 0, 2, 2, 1, 0],
  Em: [0, 2, 2, 0, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
};

const VB_W = 640;
const VB_H = 210;
const NUT = 56;
const BRIDGE = 618;
const STRING_Y = OPEN.map((_, i) => 30 + i * 30);
// Real fret spacing (each fret is 2^(1/12) closer to the bridge), scaled so fret 5 lands at x≈430.
const FRET_X = Array.from({ length: 6 }, (_, n) => NUT + 1491 * (1 - 2 ** (-n / 12)));

const bufferCache = new Map<number, AudioBuffer>();

/**
 * Karplus–Strong plucked string: a short burst of noise circulates through a delay line one
 * period long, and averaging neighbouring samples on each pass damps it like a real string.
 */
function pluckBuffer(ctx: AudioContext, midi: number): AudioBuffer {
  const cached = bufferCache.get(midi);
  if (cached) return cached;
  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / midiToFreq(midi) - 0.5));
  const length = Math.floor(sr * 3);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);
  const ring = new Float32Array(period);
  let prev = 0;
  for (let i = 0; i < period; i++) {
    prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5;
    ring[i] = prev;
  }
  for (let i = 0, p = 0; i < length; i++) {
    const next = p + 1 === period ? 0 : p + 1;
    out[i] = ring[p];
    ring[p] = 0.996 * 0.5 * (ring[p] + ring[next]);
    p = next;
  }
  bufferCache.set(midi, buffer);
  return buffer;
}

export interface GuitarOptions {
  onNote(midi: number): void;
  onLabel(text: string): void;
}

export function mountGuitar(el: HTMLElement, { onNote, onLabel }: GuitarOptions): () => void {
  const frets = FRET_X.map((x, n) => `<line x1="${x.toFixed(1)}" y1="15" x2="${x.toFixed(1)}" y2="195" class="${n === 0 ? 'nut' : 'fret'}"/>`).join('');
  const inlays = [3, 5].map((n) => `<circle cx="${((FRET_X[n - 1] + FRET_X[n]) / 2).toFixed(1)}" cy="105" r="6" class="inlay"/>`).join('');
  const labels = STRING_Y.map((y, i) => `<text x="14" y="${y + 4}" class="string-name">${STRING_NAMES[i]}</text>`).join('');
  const strings = STRING_Y.map((y, i) => `<path class="string" data-string="${i}" d="M${NUT} ${y} L${BRIDGE} ${y}" style="stroke-width:${(1 + i * 0.45).toFixed(2)}"/>`).join('');

  el.innerHTML = `
    <svg class="guitar" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="Guitar neck. Sweep the pointer across the strings to strum.">
      <rect x="${NUT}" y="15" width="${FRET_X[5] + 40 - NUT}" height="180" class="board"/>
      <circle cx="560" cy="105" r="78" class="hole-ring"/>
      <circle cx="560" cy="105" r="64" class="hole"/>
      <rect x="${BRIDGE}" y="20" width="10" height="170" rx="2" class="bridge"/>
      ${frets}${inlays}${labels}${strings}
      <g class="fingers"></g>
    </svg>
    <div class="instrument-actions">
      <div class="chords" role="group" aria-label="Chord">
        ${Object.keys(CHORDS).map((c) => `<button type="button" class="pill" data-chord="${c}" aria-pressed="${c === 'Open'}">${c}</button>`).join('')}
      </div>
      <button type="button" class="pill pill-strong" data-strum>Strum ↓</button>
    </div>`;

  const svg = el.querySelector<SVGSVGElement>('svg')!;
  const fingers = el.querySelector<SVGGElement>('.fingers')!;
  const paths = [...el.querySelectorAll<SVGPathElement>('.string')];
  const vib = OPEN.map(() => ({ amp: 0, phase: 0 }));
  const ringing: ({ src: AudioBufferSourceNode; gain: GainNode } | null)[] = OPEN.map(() => null);
  let chord = 'Open';
  let fretted = CHORDS.Open.slice().reverse();
  let raf = 0;
  let lastY: number | null = null;
  const timers: number[] = [];

  function drawFingers() {
    fingers.innerHTML = fretted
      .map((f, i) => {
        const y = STRING_Y[i];
        if (f < 0) return `<text x="38" y="${y + 4}" class="mute">×</text>`;
        if (f === 0) return `<circle cx="40" cy="${y}" r="5" class="open"/>`;
        return `<circle cx="${((FRET_X[f - 1] + FRET_X[f]) / 2).toFixed(1)}" cy="${y}" r="9" class="finger"/>`;
      })
      .join('');
  }

  function animate() {
    let moving = false;
    vib.forEach((v, i) => {
      const y = STRING_Y[i];
      if (v.amp < 0.15) {
        if (v.amp) paths[i].setAttribute('d', `M${NUT} ${y} L${BRIDGE} ${y}`);
        v.amp = 0;
        return;
      }
      moving = true;
      v.phase += 1.9;
      v.amp *= 0.94;
      const from = fretted[i] > 0 ? FRET_X[fretted[i]] : NUT;
      const mid = (from + BRIDGE) / 2;
      paths[i].setAttribute('d', `M${NUT} ${y} L${from.toFixed(1)} ${y} Q${mid.toFixed(1)} ${(y + Math.sin(v.phase) * v.amp * 2).toFixed(2)} ${BRIDGE} ${y}`);
    });
    raf = moving ? requestAnimationFrame(animate) : 0;
  }

  function pluck(i: number) {
    const fret = fretted[i];
    vib[i].amp = fret < 0 ? 1 : 5;
    if (!raf) raf = requestAnimationFrame(animate);
    if (fret < 0) return;

    const midi = OPEN[i] + fret;
    const { ctx, master } = audio();
    const now = ctx.currentTime;
    const prev = ringing[i];
    if (prev) {
      // Re-plucking a string damps whatever it was already playing.
      prev.gain.gain.setTargetAtTime(0, now, 0.015);
      prev.src.stop(now + 0.1);
    }
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(ctx, midi);
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    src.connect(gain).connect(master);
    src.start(now);
    src.onended = () => {
      if (ringing[i]?.src === src) ringing[i] = null;
    };
    ringing[i] = { src, gain };
    onNote(midi);
  }

  function strum() {
    for (let k = 0; k < OPEN.length; k++) {
      const i = OPEN.length - 1 - k;
      timers.push(window.setTimeout(() => pluck(i), k * 22));
    }
    timers.push(window.setTimeout(() => onLabel(`${chord === 'Open' ? 'Open strings' : `${chord} chord`}`), 140));
  }

  const toSvgY = (clientY: number) => {
    const r = svg.getBoundingClientRect();
    return ((clientY - r.top) / r.height) * VB_H;
  };

  svg.addEventListener('pointermove', (e) => {
    const y = toSvgY(e.clientY);
    if (lastY !== null) {
      STRING_Y.forEach((sy, i) => {
        if ((lastY! - sy) * (y - sy) < 0) pluck(i);
      });
    }
    lastY = y;
  });
  svg.addEventListener('pointerdown', (e) => {
    const y = toSvgY(e.clientY);
    lastY = y;
    let nearest = 0;
    STRING_Y.forEach((sy, i) => {
      if (Math.abs(sy - y) < Math.abs(STRING_Y[nearest] - y)) nearest = i;
    });
    if (Math.abs(STRING_Y[nearest] - y) < 14) pluck(nearest);
  });
  svg.addEventListener('pointerleave', () => (lastY = null));

  el.querySelector('.chords')!.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-chord]');
    if (!btn?.dataset.chord) return;
    chord = btn.dataset.chord;
    fretted = CHORDS[chord].slice().reverse();
    el.querySelectorAll('[data-chord]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    drawFingers();
    strum();
  });
  el.querySelector('[data-strum]')!.addEventListener('click', strum);

  drawFingers();

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    ringing.forEach((r) => r?.src.stop());
  };
}
