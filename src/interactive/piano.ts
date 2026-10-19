import { audio, midiToFreq } from '../lib/audio';

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const noteName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

// Standard DAW "musical typing" layout: home row = white keys, row above = black keys.
const KEYMAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69,
  u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76, "'": 77,
};
const KEY_FOR = Object.fromEntries(Object.entries(KEYMAP).map(([k, m]) => [m, k.toUpperCase()]));

// Für Elise, opening phrase — [midi note or rest, length in sixteenths].
const FUR_ELISE: [number | null, number][] = [
  [76, 1], [75, 1],
  [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1],
  [69, 2], [null, 1], [60, 1], [64, 1], [69, 1],
  [71, 2], [null, 1], [64, 1], [68, 1], [71, 1],
  [72, 2], [null, 1], [64, 1], [76, 1], [75, 1],
  [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1],
  [69, 2], [null, 1], [60, 1], [64, 1], [69, 1],
  [71, 2], [null, 1], [64, 1], [72, 1], [71, 1],
  [69, 4],
];
const SIXTEENTH_MS = 150;

/**
 * Additive piano-ish tone: a few slightly stretched harmonics through a closing low-pass.
 * `at` schedules it ahead of time (for the sequencer); `dest` routes it to a mixer channel.
 */
export function playPiano(midi: number, velocity = 0.8, at?: number, dest?: AudioNode): () => void {
  const { ctx, master } = audio();
  const t = at ?? ctx.currentTime;
  const freq = midiToFreq(midi);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(velocity * 0.35, t + 0.008);
  out.gain.exponentialRampToValueAtTime(velocity * 0.12, t + 0.45);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(freq * 8, 12000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 400), t + 1.5);
  lp.connect(out).connect(dest ?? master);

  const oscs = [[1, 1], [2, 0.45], [3, 0.22], [4, 0.12], [5, 0.06]].map(([harmonic, level]) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * harmonic * (1 + 0.0004 * harmonic * harmonic);
    const g = ctx.createGain();
    g.gain.value = level * 0.5;
    osc.connect(g).connect(lp);
    osc.start(t);
    osc.stop(t + 3.3);
    return osc;
  });

  return () => {
    const now = ctx.currentTime;
    const gain = out.gain;
    if (gain.cancelAndHoldAtTime) {
      gain.cancelAndHoldAtTime(now);
    } else {
      const v = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(v, now);
    }
    gain.setTargetAtTime(0, now, 0.09);
    oscs.forEach((o) => {
      try {
        o.stop(now + 0.6);
      } catch {
        // Already stopped.
      }
    });
  };
}

export interface PianoOptions {
  onNote(midi: number): void;
  /** Whether computer-keyboard input should currently play notes. */
  isActive(): boolean;
}

export function mountPiano(el: HTMLElement, { onNote, isActive }: PianoOptions): () => void {
  const lo = 60;
  const hi = el.clientWidth && el.clientWidth < 520 ? 72 : 84;
  const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const whites = range.filter((m) => !isBlack(m));
  const whiteW = 100 / whites.length;

  const keys = range
    .map((m) => {
      const label = KEY_FOR[m] ? `<span class="kbd">${KEY_FOR[m]}</span>` : '';
      if (!isBlack(m)) return `<button type="button" class="key white" data-midi="${m}" aria-label="${noteName(m)}">${label}</button>`;
      const left = whites.filter((x) => x < m).length * whiteW;
      return `<button type="button" class="key black" data-midi="${m}" style="left:${left}%;width:${whiteW * 0.62}%" aria-label="${noteName(m)}">${label}</button>`;
    })
    .join('');

  el.innerHTML = `
    <div class="piano" role="group" aria-label="Piano keyboard">${keys}</div>
    <div class="instrument-actions">
      <button type="button" class="pill" data-demo aria-pressed="false">▶ Play Für Elise</button>
      <span class="instrument-tip">Keyboard: <kbd>A</kbd>–<kbd>'</kbd> white keys, <kbd>W</kbd> <kbd>E</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd>… black keys</span>
    </div>`;

  const piano = el.querySelector<HTMLElement>('.piano')!;
  const demoBtn = el.querySelector<HTMLButtonElement>('[data-demo]')!;
  const keyEl = (m: number) => piano.querySelector<HTMLElement>(`[data-midi="${m}"]`);

  const held = new Map<string, { midi: number; release: () => void }>();
  const dragging = new Set<number>();
  let demoTimers: number[] = [];

  function start(id: string, midi: number) {
    stop(id);
    held.set(id, { midi, release: playPiano(midi) });
    keyEl(midi)?.classList.add('down');
    onNote(midi);
  }

  function stop(id: string) {
    const voice = held.get(id);
    if (!voice) return;
    voice.release();
    held.delete(id);
    if (![...held.values()].some((v) => v.midi === voice.midi)) keyEl(voice.midi)?.classList.remove('down');
  }

  const stopAll = () => [...held.keys()].forEach(stop);
  const midiAt = (target: EventTarget | null) => {
    const key = (target as Element | null)?.closest<HTMLElement>('.key');
    return key ? Number(key.dataset.midi) : null;
  };

  piano.addEventListener('pointerdown', (e) => {
    const midi = midiAt(e.target);
    if (midi === null) return;
    e.preventDefault();
    // Touch pointers are implicitly captured; release so sliding across keys plays a glissando.
    const target = e.target as Element;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    dragging.add(e.pointerId);
    start(`p${e.pointerId}`, midi);
  });
  piano.addEventListener('pointerover', (e) => {
    if (!dragging.has(e.pointerId)) return;
    const midi = midiAt(e.target);
    if (midi !== null && held.get(`p${e.pointerId}`)?.midi !== midi) start(`p${e.pointerId}`, midi);
  });
  const endPointer = (e: PointerEvent) => {
    dragging.delete(e.pointerId);
    stop(`p${e.pointerId}`);
  };
  addEventListener('pointerup', endPointer);
  addEventListener('pointercancel', endPointer);

  // Keyboard activation of a focused key button (Enter/Space) arrives as a click with detail 0.
  piano.addEventListener('click', (e) => {
    const midi = midiAt(e.target);
    if (e.detail !== 0 || midi === null) return;
    start('focus', midi);
    demoTimers.push(window.setTimeout(() => stop('focus'), 300));
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || !isActive()) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = e.key.toLowerCase();
    const midi = KEYMAP[key];
    if (midi === undefined) return;
    e.preventDefault();
    start(`k${key}`, midi);
  };
  const onKeyUp = (e: KeyboardEvent) => stop(`k${e.key.toLowerCase()}`);
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', stopAll);

  function stopDemo() {
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    stop('demo');
    demoBtn.setAttribute('aria-pressed', 'false');
    demoBtn.textContent = '▶ Play Für Elise';
  }

  demoBtn.addEventListener('click', () => {
    if (demoBtn.getAttribute('aria-pressed') === 'true') return stopDemo();
    stopDemo();
    demoBtn.setAttribute('aria-pressed', 'true');
    demoBtn.textContent = '■ Stop';
    let at = 0;
    for (const [midi, units] of FUR_ELISE) {
      if (midi !== null) demoTimers.push(window.setTimeout(() => start('demo', midi), at));
      at += units * SIXTEENTH_MS;
    }
    demoTimers.push(window.setTimeout(stopDemo, at + 600));
  });

  return () => {
    stopDemo();
    stopAll();
    removeEventListener('pointerup', endPointer);
    removeEventListener('pointercancel', endPointer);
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', stopAll);
  };
}
