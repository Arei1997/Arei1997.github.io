import { audio } from '../lib/audio';
import { store } from '../lib/storage';
import { mountGuitar } from './guitar';
import { playDrum, playSynth, type DrumId, type SynthId } from './instruments';
import { isBlack, mountPiano, noteName } from './piano';

const STEPS = 16;
const ROLL_LO = 60;
const ROLL_HI = 83;
const STORE_KEY = 'studio:song';
/** How far ahead (s) the scheduler queues notes; the timer only has to fire well within this window. */
const LOOKAHEAD = 0.12;

const DRUMS: { id: DrumId; name: string }[] = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'clap', name: 'Clap' },
  { id: 'hat', name: 'Hi-hat' },
  { id: 'openhat', name: 'Open hat' },
  { id: 'perc', name: 'Perc' },
];
const SYNTHS: { id: SynthId; name: string }[] = [
  { id: 'pluck', name: 'Pluck' },
  { id: 'keys', name: 'Keys' },
  { id: 'saw', name: 'Saw lead' },
  { id: 'bass808', name: '808' },
];

type ChannelId = DrumId | 'synth';
const CHANNELS: ChannelId[] = [...DRUMS.map((d) => d.id), 'synth'];

type Tab = 'rack' | 'roll' | 'keys' | 'guitar';
const TABS: [Tab, string][] = [
  ['rack', 'Channel rack'],
  ['roll', 'Piano roll'],
  ['keys', 'Keys'],
  ['guitar', 'Guitar'],
];

interface Song {
  bpm: number;
  swing: number;
  synth: SynthId;
  drums: Record<DrumId, boolean[]>;
  /** [step, midi] pairs; several notes on one step make a chord. */
  notes: [number, number][];
  volume: Record<ChannelId, number>;
  mute: Record<ChannelId, boolean>;
}

interface Preset {
  bpm: number;
  swing: number;
  synth: SynthId;
  /** One character per step: x = hit. */
  drums: Partial<Record<DrumId, string>>;
  notes: [number, number][];
}

const PRESETS: Record<string, Preset> = {
  'Lo-fi': {
    bpm: 82, swing: 0.3, synth: 'keys',
    drums: { kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '.......x.......x' },
    notes: [[0, 64], [0, 67], [0, 71], [0, 74], [8, 60], [8, 64], [8, 67], [8, 71], [4, 79], [6, 76], [12, 74], [14, 71]],
  },
  House: {
    bpm: 124, swing: 0, synth: 'pluck',
    drums: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', openhat: '..............x.' },
    notes: [[2, 69], [2, 72], [2, 76], [6, 69], [6, 72], [6, 76], [10, 67], [10, 71], [10, 74], [13, 67], [13, 71], [13, 74]],
  },
  Trap: {
    bpm: 140, swing: 0, synth: 'bass808',
    drums: { kick: 'x......x..x.....', snare: '........x.......', clap: '........x.......', hat: 'x.x.x.x.xxx.x.xx' },
    notes: [[0, 64], [7, 64], [10, 67], [14, 62]],
  },
  'Boom bap': {
    bpm: 92, swing: 0.2, synth: 'keys',
    drums: { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', openhat: '.......x........' },
    notes: [[0, 62], [0, 65], [0, 69], [0, 72], [8, 60], [8, 64], [8, 67], [8, 71]],
  },
  Synthwave: {
    bpm: 108, swing: 0, synth: 'saw',
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx' },
    notes: [[0, 69], [2, 72], [4, 76], [6, 72], [8, 67], [10, 71], [12, 74], [14, 71]],
  },
  Empty: { bpm: 120, swing: 0, synth: 'pluck', drums: {}, notes: [] },
};

const ICONS = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
  stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5h9v9h-9z"/></svg>',
  rec: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.5"/></svg>',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const stepsFrom = (pattern = '') => Array.from({ length: STEPS }, (_, i) => pattern[i] === 'x');
const perChannel = <T>(value: T) => Object.fromEntries(CHANNELS.map((c) => [c, value])) as Record<ChannelId, T>;

function fromPreset(name: string, keepMix?: Song): Song {
  const p = PRESETS[name];
  return {
    bpm: p.bpm,
    swing: p.swing,
    synth: p.synth,
    drums: Object.fromEntries(DRUMS.map((d) => [d.id, stepsFrom(p.drums[d.id])])) as Record<DrumId, boolean[]>,
    notes: p.notes.map(([s, m]) => [s, m]),
    volume: keepMix ? { ...keepMix.volume } : perChannel(0.8),
    mute: keepMix ? { ...keepMix.mute } : perChannel(false),
  };
}

/** Restores the visitor's last pattern, falling back to the default for anything malformed. */
function loadSong(): Song {
  const song = fromPreset('Lo-fi');
  const saved = store.get<Partial<Song> | null>(STORE_KEY, null);
  if (!saved || typeof saved !== 'object') return song;
  if (typeof saved.bpm === 'number') song.bpm = clamp(Math.round(saved.bpm), 60, 180);
  if (typeof saved.swing === 'number') song.swing = clamp(saved.swing, 0, 0.6);
  if (SYNTHS.some((s) => s.id === saved.synth)) song.synth = saved.synth as SynthId;
  for (const d of DRUMS) {
    const row = saved.drums?.[d.id];
    if (Array.isArray(row) && row.length === STEPS) song.drums[d.id] = row.map(Boolean);
  }
  if (Array.isArray(saved.notes)) {
    song.notes = saved.notes.filter(
      (n): n is [number, number] =>
        Array.isArray(n) && Number.isInteger(n[0]) && n[0] >= 0 && n[0] < STEPS && Number.isInteger(n[1]) && n[1] >= ROLL_LO && n[1] <= ROLL_HI,
    );
  }
  for (const c of CHANNELS) {
    if (typeof saved.volume?.[c] === 'number') song.volume[c] = clamp(saved.volume[c], 0, 1);
    if (typeof saved.mute?.[c] === 'boolean') song.mute[c] = saved.mute[c];
  }
  return song;
}

/** Turns an element into an FL-style knob: drag vertically, scroll, or use the arrow keys. */
function knob(el: HTMLElement, initial: number, onChange: (v: number) => void) {
  let value = initial;
  let startY = 0, startValue = 0;
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.tabIndex = 0;
  const render = () => {
    el.style.setProperty('--turn', `${-135 + value * 270}deg`);
    el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  const set = (v: number, notify = true) => {
    value = clamp(v, 0, 1);
    render();
    if (notify) onChange(value);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startValue = value;
  });
  el.addEventListener('pointermove', (e) => {
    if (el.hasPointerCapture(e.pointerId)) set(startValue + (startY - e.clientY) / 120);
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    set(value + (e.deltaY < 0 ? 0.05 : -0.05));
  }, { passive: false });
  el.addEventListener('keydown', (e) => {
    const delta = ({ ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 } as Record<string, number>)[e.key];
    if (!delta) return;
    e.preventDefault();
    set(value + delta);
  });
  render();
  return { set: (v: number) => set(v, false) };
}

export interface DawOptions {
  /** Whether the studio is on screen — gates keyboard shortcuts. */
  inView(): boolean;
}

export function mountDaw(el: HTMLElement, { inView }: DawOptions): () => void {
  let song = loadSong();
  let tab: Tab = 'rack';
  let playing = false, recording = false;
  let timer = 0, raf = 0, step = 0, nextBase = 0, saveTimer = 0;
  let current = -1, currentTime = 0;
  let paint: { kind: 'drum'; ch: DrumId; value: boolean } | { kind: 'note'; value: boolean } | null = null;
  const queue: { step: number; time: number }[] = [];
  const buses = new Map<ChannelId, GainNode>();
  const cleanups: (() => void)[] = [];

  el.innerHTML = `
    <div class="daw">
      <div class="transport">
        <button type="button" class="tp-btn tp-play" data-play aria-pressed="false" aria-label="Play">${ICONS.play}</button>
        <button type="button" class="tp-btn" data-stop aria-label="Stop">${ICONS.stop}</button>
        <button type="button" class="tp-btn tp-rec" data-rec aria-pressed="false" aria-label="Record" title="Record: play Keys or Guitar while the loop runs to add notes to the piano roll">${ICONS.rec}</button>
        <div class="tp-lcd tp-bpm" data-bpm role="spinbutton" tabindex="0" aria-label="Tempo in BPM. Drag up or down, scroll, or use the arrow keys." aria-valuemin="60" aria-valuemax="180"><b></b><small>BPM</small></div>
        <div class="tp-lcd"><b data-pos>1.1</b><small>Beat</small></div>
        <div class="tp-lcd tp-note"><b data-note>—</b><small>Note</small></div>
        <div class="tp-knob"><span class="knob" data-swing aria-label="Swing"></span><small>Swing</small></div>
        <select class="tp-select" data-preset aria-label="Load a pattern">
          <option value="">Patterns…</option>
          ${Object.keys(PRESETS).map((n) => `<option>${n}</option>`).join('')}
        </select>
        <canvas class="viz" aria-hidden="true"></canvas>
      </div>
      <div class="daw-tabs" role="tablist" aria-label="Studio view">
        ${TABS.map(([id, label], i) => `<button type="button" role="tab" id="daw-tab-${id}" aria-controls="daw-panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`).join('')}
      </div>
      ${TABS.map(([id], i) => `<div class="daw-panel daw-${id}" role="tabpanel" id="daw-panel-${id}" aria-labelledby="daw-tab-${id}"${i === 0 ? '' : ' hidden'}></div>`).join('')}
    </div>`;

  const $ = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const recBtn = $<HTMLButtonElement>('[data-rec]');
  const bpmEl = $('[data-bpm]');
  const posEl = $('[data-pos]');
  const noteEl = $('[data-note]');
  const presetSel = $<HTMLSelectElement>('[data-preset]');
  const tabs = [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const panel = (id: Tab) => $(`#daw-panel-${id}`);
  const rack = panel('rack');
  const roll = panel('roll');

  const synthName = () => SYNTHS.find((s) => s.id === song.synth)!.name;
  const channelName = (ch: ChannelId) => (ch === 'synth' ? synthName() : DRUMS.find((d) => d.id === ch)!.name);
  const hasNote = (s: number, m: number) => song.notes.some(([ns, nm]) => ns === s && nm === m);
  const stepDur = () => 60 / song.bpm / 4;

  function save() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => store.set(STORE_KEY, song), 300);
  }

  // ---------- Audio ----------

  function applyMix() {
    // Squared so the knob feels even to the ear.
    for (const [ch, gain] of buses) gain.gain.value = song.mute[ch] ? 0 : song.volume[ch] ** 2 * 1.2;
  }

  function ensureAudio() {
    const g = audio();
    if (!buses.size) {
      for (const ch of CHANNELS) {
        const gain = g.ctx.createGain();
        gain.connect(g.master);
        buses.set(ch, gain);
      }
    }
    applyMix();
    return g;
  }

  function trigger(s: number, t: number) {
    for (const d of DRUMS) if (song.drums[d.id][s]) playDrum(d.id, t, buses.get(d.id)!);
    for (const [ns, m] of song.notes) if (ns === s) playSynth(song.synth, m, t, stepDur(), buses.get('synth')!);
  }

  /** Lookahead scheduler: a coarse timer queues notes on the precise audio clock just ahead of time. */
  function schedule() {
    const { ctx } = audio();
    while (nextBase < ctx.currentTime + LOOKAHEAD) {
      const dur = stepDur();
      const t = nextBase + (step % 2 ? song.swing * dur * 0.5 : 0);
      trigger(step, t);
      queue.push({ step, time: t });
      nextBase += dur;
      step = (step + 1) % STEPS;
    }
  }

  function frame() {
    const now = audio().ctx.currentTime;
    let moved = false;
    while (queue.length && queue[0].time <= now) {
      const q = queue.shift()!;
      current = q.step;
      currentTime = q.time;
      moved = true;
    }
    if (moved) setPlayhead(current);
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (playing) return;
    const { ctx } = ensureAudio();
    playing = true;
    step = 0;
    current = -1;
    queue.length = 0;
    nextBase = ctx.currentTime + 0.05;
    schedule();
    timer = window.setInterval(schedule, 25);
    raf = requestAnimationFrame(frame);
    updateTransport();
  }

  function stop() {
    playing = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    queue.length = 0;
    current = -1;
    setPlayhead(-1);
    updateTransport();
  }

  function updateTransport() {
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    playBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
    recBtn.setAttribute('aria-pressed', String(recording));
  }

  function setPlayhead(s: number) {
    rack.querySelectorAll('.step.now').forEach((b) => b.classList.remove('now'));
    roll.querySelectorAll('.cell.now').forEach((b) => b.classList.remove('now'));
    if (s >= 0) {
      rack.querySelectorAll(`.step[data-step="${s}"]`).forEach((b) => b.classList.add('now'));
      roll.querySelectorAll(`.cell[data-s="${s}"][aria-pressed="true"]`).forEach((b) => b.classList.add('now'));
    }
    const head = roll.querySelector<HTMLElement>('.roll-head');
    if (head) {
      head.hidden = s < 0;
      head.style.left = `${(s / STEPS) * 100}%`;
    }
    posEl.textContent = s < 0 ? '1.1' : `${Math.floor(s / 4) + 1}.${(s % 4) + 1}`;
  }

  // ---------- Channel rack ----------

  function renderRack() {
    rack.innerHTML = `
      <div class="rack">
        ${CHANNELS.map((ch) => {
          const name = channelName(ch);
          const cells = Array.from({ length: STEPS }, (_, i) => {
            const on = ch === 'synth' ? song.notes.some((n) => n[0] === i) : song.drums[ch][i];
            return `<button type="button" class="step g${Math.floor(i / 4) % 2}${ch === 'synth' ? ' melodic' : ''}" data-ch="${ch}" data-step="${i}" aria-pressed="${on}" aria-label="${name} step ${i + 1}"></button>`;
          }).join('');
          return `
          <div class="rack-row${ch === 'synth' ? ' synth-row' : ''}">
            <button type="button" class="led" data-mute="${ch}" aria-pressed="${!song.mute[ch]}" aria-label="${name} channel on"></button>
            <span class="knob small" data-vol="${ch}" aria-label="${name} volume"></span>
            <button type="button" class="ch-name" data-name="${ch}" title="${ch === 'synth' ? 'Open the piano roll' : 'Preview'}">${name}</button>
            <div class="steps">${cells}</div>
          </div>`;
        }).join('')}
      </div>
      <p class="daw-hint">Click or drag to paint steps · <kbd>Space</kbd> play / stop · the ${synthName()} row opens the piano roll</p>`;
    rack.querySelectorAll<HTMLElement>('[data-vol]').forEach((k) => {
      const ch = k.dataset.vol as ChannelId;
      knob(k, song.volume[ch], (v) => {
        song.volume[ch] = v;
        applyMix();
        save();
      });
    });
  }

  function refreshSynthRow() {
    rack.querySelectorAll<HTMLElement>('.step.melodic').forEach((b) => {
      b.setAttribute('aria-pressed', String(song.notes.some((n) => n[0] === Number(b.dataset.step))));
    });
    const name = rack.querySelector<HTMLElement>('[data-name="synth"]');
    if (name) name.textContent = synthName();
  }

  function setDrumStep(ch: DrumId, i: number, value: boolean) {
    if (song.drums[ch][i] === value) return;
    song.drums[ch][i] = value;
    rack.querySelector(`.step[data-ch="${ch}"][data-step="${i}"]`)?.setAttribute('aria-pressed', String(value));
    if (value && !playing) playDrum(ch, ensureAudio().ctx.currentTime, buses.get(ch)!);
    save();
  }

  rack.addEventListener('pointerdown', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('.step');
    if (!btn) return;
    e.preventDefault();
    if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
    const ch = btn.dataset.ch as ChannelId;
    if (ch === 'synth') return selectTab('roll');
    const i = Number(btn.dataset.step);
    paint = { kind: 'drum', ch, value: !song.drums[ch][i] };
    setDrumStep(ch, i, paint.value);
  });
  rack.addEventListener('pointerover', (e) => {
    if (paint?.kind !== 'drum') return;
    const btn = (e.target as Element).closest<HTMLElement>('.step');
    if (btn?.dataset.ch === paint.ch) setDrumStep(paint.ch, Number(btn.dataset.step), paint.value);
  });
  rack.addEventListener('click', (e) => {
    const target = e.target as Element;
    const stepBtn = target.closest<HTMLElement>('.step');
    // Keyboard activation (Enter/Space on a focused step) arrives as a click with detail 0.
    if (stepBtn && e.detail === 0) {
      const ch = stepBtn.dataset.ch as ChannelId;
      if (ch === 'synth') return selectTab('roll');
      const i = Number(stepBtn.dataset.step);
      return setDrumStep(ch, i, !song.drums[ch][i]);
    }
    const led = target.closest<HTMLElement>('[data-mute]');
    if (led) {
      const ch = led.dataset.mute as ChannelId;
      song.mute[ch] = !song.mute[ch];
      led.setAttribute('aria-pressed', String(!song.mute[ch]));
      applyMix();
      save();
      return;
    }
    const name = target.closest<HTMLElement>('[data-name]');
    if (name) {
      const ch = name.dataset.name as ChannelId;
      if (ch === 'synth') return selectTab('roll');
      playDrum(ch, ensureAudio().ctx.currentTime, buses.get(ch)!);
    }
  });

  // ---------- Piano roll ----------

  function renderRoll() {
    const rows: number[] = [];
    for (let m = ROLL_HI; m >= ROLL_LO; m--) rows.push(m);
    roll.innerHTML = `
      <div class="roll-tools">
        <div class="seg-mini" role="group" aria-label="Instrument">
          ${SYNTHS.map((s) => `<button type="button" data-synth="${s.id}" aria-pressed="${s.id === song.synth}">${s.name}</button>`).join('')}
        </div>
        <button type="button" class="tp-small" data-clear>Clear notes</button>
      </div>
      <div class="roll">
        <div class="roll-keys" aria-hidden="true">
          ${rows.map((m) => `<span class="${isBlack(m) ? 'b' : ''}">${m % 12 === 0 ? noteName(m) : ''}</span>`).join('')}
        </div>
        <div class="roll-grid">
          ${rows.map((m) => Array.from({ length: STEPS }, (_, s) => `<button type="button" class="cell${isBlack(m) ? ' b' : ''}${s % 4 === 0 ? ' beat' : ''}" data-m="${m}" data-s="${s}" aria-pressed="${hasNote(s, m)}" aria-label="${noteName(m)}, step ${s + 1}"></button>`).join('')).join('')}
          <div class="roll-head" hidden></div>
        </div>
      </div>`;
  }

  function setNote(s: number, m: number, on: boolean, preview = true) {
    if (hasNote(s, m) === on) return;
    song.notes = on ? [...song.notes, [s, m]] : song.notes.filter(([ns, nm]) => !(ns === s && nm === m));
    roll.querySelector(`.cell[data-s="${s}"][data-m="${m}"]`)?.setAttribute('aria-pressed', String(on));
    refreshSynthRow();
    if (on && preview && !playing) {
      ensureAudio();
      playSynth(song.synth, m, audio().ctx.currentTime, stepDur(), buses.get('synth')!);
    }
    save();
  }

  roll.addEventListener('pointerdown', (e) => {
    const cell = (e.target as Element).closest<HTMLElement>('.cell');
    if (!cell) return;
    e.preventDefault();
    if (cell.hasPointerCapture(e.pointerId)) cell.releasePointerCapture(e.pointerId);
    const s = Number(cell.dataset.s), m = Number(cell.dataset.m);
    paint = { kind: 'note', value: !hasNote(s, m) };
    setNote(s, m, paint.value);
  });
  roll.addEventListener('pointerover', (e) => {
    if (paint?.kind !== 'note') return;
    const cell = (e.target as Element).closest<HTMLElement>('.cell');
    if (cell) setNote(Number(cell.dataset.s), Number(cell.dataset.m), paint.value);
  });
  roll.addEventListener('click', (e) => {
    const target = e.target as Element;
    const cell = target.closest<HTMLElement>('.cell');
    if (cell && e.detail === 0) {
      const s = Number(cell.dataset.s), m = Number(cell.dataset.m);
      return setNote(s, m, !hasNote(s, m));
    }
    const synth = target.closest<HTMLElement>('[data-synth]');
    if (synth) {
      song.synth = synth.dataset.synth as SynthId;
      roll.querySelectorAll('[data-synth]').forEach((b) => b.setAttribute('aria-pressed', String(b === synth)));
      refreshSynthRow();
      ensureAudio();
      if (!playing) playSynth(song.synth, 72, audio().ctx.currentTime, stepDur(), buses.get('synth')!);
      save();
      return;
    }
    if (target.closest('[data-clear]')) {
      song.notes = [];
      renderRoll();
      refreshSynthRow();
      save();
    }
  });

  const endPaint = () => (paint = null);
  addEventListener('pointerup', endPaint);
  addEventListener('pointercancel', endPaint);
  cleanups.push(() => {
    removeEventListener('pointerup', endPaint);
    removeEventListener('pointercancel', endPaint);
  });

  // ---------- Live instruments (mounted the first time their tab opens) ----------

  /** Shows a live note and, while recording, quantises it onto the nearest step of the loop. */
  function onLiveNote(midi: number) {
    noteEl.textContent = noteName(midi);
    if (!recording || !playing || midi < ROLL_LO || midi > ROLL_HI) return;
    const pos = Math.max(0, current) + (audio().ctx.currentTime - currentTime) / stepDur();
    const s = ((Math.round(pos) % STEPS) + STEPS) % STEPS;
    setNote(s, midi, true, false);
  }

  const mounted = new Set<Tab>();
  function mountInstrument(id: Tab) {
    if (mounted.has(id)) return;
    mounted.add(id);
    if (id === 'keys') cleanups.push(mountPiano(panel('keys'), { onNote: onLiveNote, isActive: () => inView() && tab === 'keys' }));
    if (id === 'guitar') cleanups.push(mountGuitar(panel('guitar'), { onNote: onLiveNote, onLabel: (s) => (noteEl.textContent = s.replace(' chord', '')) }));
  }

  function selectTab(id: Tab) {
    tab = id;
    tabs.forEach((t) => {
      const on = t.id === `daw-tab-${id}`;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    TABS.forEach(([t]) => (panel(t).hidden = t !== id));
    mountInstrument(id);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(TABS[i][0]));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      selectTab(TABS[next][0]);
    });
  });

  // ---------- Transport controls ----------

  function setBpm(v: number) {
    song.bpm = clamp(Math.round(v), 60, 180);
    bpmEl.querySelector('b')!.textContent = String(song.bpm);
    bpmEl.setAttribute('aria-valuenow', String(song.bpm));
    save();
  }

  let bpmStartY = 0, bpmStart = 0;
  bpmEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bpmEl.setPointerCapture(e.pointerId);
    bpmStartY = e.clientY;
    bpmStart = song.bpm;
  });
  bpmEl.addEventListener('pointermove', (e) => {
    if (bpmEl.hasPointerCapture(e.pointerId)) setBpm(bpmStart + (bpmStartY - e.clientY) / 3);
  });
  bpmEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    setBpm(song.bpm + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  bpmEl.addEventListener('keydown', (e) => {
    const delta = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 } as Record<string, number>)[e.key];
    if (!delta) return;
    e.preventDefault();
    setBpm(song.bpm + delta);
  });

  const swing = knob($('[data-swing]'), song.swing / 0.6, (v) => {
    song.swing = v * 0.6;
    save();
  });

  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  $('[data-stop]').addEventListener('click', stop);
  recBtn.addEventListener('click', () => {
    recording = !recording;
    updateTransport();
    if (recording) {
      if (tab !== 'keys' && tab !== 'guitar') selectTab('keys');
      play();
    }
  });

  presetSel.addEventListener('change', () => {
    if (!presetSel.value) return;
    song = fromPreset(presetSel.value, song);
    presetSel.value = '';
    renderRack();
    renderRoll();
    setBpm(song.bpm);
    swing.set(song.swing / 0.6);
    applyMix();
    save();
  });

  // FL's muscle memory: Space toggles playback (unless a control has focus and wants Space itself).
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat || !inView()) return;
    const t = e.target;
    if (t instanceof Element && t.closest('button, input, select, textarea, a, [role="slider"], [role="spinbutton"], [contenteditable="true"]')) return;
    e.preventDefault();
    if (playing) stop();
    else play();
  };
  // Browsers throttle timers in background tabs, which would make the loop stutter.
  const onVisibility = () => document.hidden && stop();
  addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  renderRack();
  renderRoll();
  setBpm(song.bpm);
  updateTransport();

  return () => {
    stop();
    clearTimeout(saveTimer);
    store.set(STORE_KEY, song);
    removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    cleanups.forEach((fn) => fn());
    buses.forEach((g) => g.disconnect());
  };
}
