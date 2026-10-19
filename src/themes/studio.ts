import { mountGuitar } from '../interactive/guitar';
import { mountPiano, noteName } from '../interactive/piano';
import { audioIfReady, midiToFreq } from '../lib/audio';
import { pad, visibleLoop } from '../lib/dom';
import { currentSection, onSectionChange, scrollProgress, type SectionChange } from '../lib/sections';
import { SECTIONS, SECTION_TITLES, type MountContext } from './index';

// Four minutes thirty-three seconds — the length of the "track" you scroll through.
const TRACK_SECONDS = 273;

const clock = (s: number) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

function mountVisualizer(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  const BARS = 48;
  let bins: Uint8Array<ArrayBuffer> | null = null;

  return visibleLoop(canvas, (_dt, now) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const g = audioIfReady();
    if (g && !bins) bins = new Uint8Array(new ArrayBuffer(g.analyser.frequencyBinCount));
    if (g && bins) g.analyser.getByteFrequencyData(bins);

    const bw = w / BARS;
    for (let i = 0; i < BARS; i++) {
      const idle = 0.07 + 0.05 * Math.sin(now / 700 + i * 0.45);
      // Log-ish spacing so the musically useful low end gets most of the bars.
      const level = bins ? bins[Math.floor((i / BARS) ** 1.7 * bins.length * 0.7)] / 255 : 0;
      const bh = Math.max(idle, level) * h;
      ctx.fillStyle = level > idle ? '#e8c46a' : 'rgba(232, 196, 106, 0.35)';
      ctx.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 2), bh);
    }
  });
}

function mountHud(hud: HTMLElement): () => void {
  const bar = document.createElement('div');
  bar.className = 'playhead';
  bar.innerHTML = '<div class="playhead-fill"></div>';
  const np = document.createElement('div');
  np.className = 'now-playing';
  np.innerHTML = `
    <span class="vinyl" aria-hidden="true"></span>
    <span class="np-text"><span class="np-label">Now playing</span><b class="np-title"></b></span>
    <span class="np-time"></span>`;
  hud.append(bar, np);

  const fill = bar.querySelector<HTMLElement>('.playhead-fill')!;
  const title = np.querySelector<HTMLElement>('.np-title')!;
  const time = np.querySelector<HTMLElement>('.np-time')!;

  const placeTicks = () => {
    bar.querySelectorAll('.playhead-tick').forEach((t) => t.remove());
    const total = document.documentElement.scrollHeight - innerHeight;
    if (total <= 0) return;
    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const tick = document.createElement('span');
      tick.className = 'playhead-tick';
      tick.style.left = `${Math.min(100, ((el.offsetTop - innerHeight * 0.45) / total) * 100)}%`;
      bar.append(tick);
    }
  };

  let raf = 0;
  let spinTimer = 0;
  const update = () => {
    raf = 0;
    const p = scrollProgress();
    fill.style.transform = `scaleX(${p})`;
    time.textContent = `${clock(p * TRACK_SECONDS)} / ${clock(TRACK_SECONDS)}`;
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
    np.classList.add('scrubbing');
    clearTimeout(spinTimer);
    spinTimer = window.setTimeout(() => np.classList.remove('scrubbing'), 350);
  };
  const showTrack = (s: SectionChange) => {
    title.textContent = s.index < 0 ? 'Intro' : `${pad(s.index + 1)} · ${SECTION_TITLES[SECTIONS[s.index]]}`;
  };

  const ro = new ResizeObserver(placeTicks);
  ro.observe(document.body);
  addEventListener('scroll', onScroll, { passive: true });
  const offSection = onSectionChange(showTrack);
  showTrack(currentSection());
  update();

  return () => {
    ro.disconnect();
    removeEventListener('scroll', onScroll);
    offSection();
    cancelAnimationFrame(raf);
    clearTimeout(spinTimer);
    bar.remove();
    np.remove();
  };
}

export function mount({ stage, hud }: MountContext) {
  stage.innerHTML = `
    <div class="studio">
      <div class="studio-top">
        <div class="tabs" role="tablist" aria-label="Instrument">
          <button type="button" role="tab" id="tab-piano" aria-controls="panel-piano" aria-selected="true">Piano</button>
          <button type="button" role="tab" id="tab-guitar" aria-controls="panel-guitar" aria-selected="false" tabindex="-1">Guitar</button>
        </div>
        <output class="lcd">Ready</output>
      </div>
      <canvas class="viz" aria-hidden="true"></canvas>
      <div class="panel" role="tabpanel" id="panel-piano" aria-labelledby="tab-piano"></div>
      <div class="panel" role="tabpanel" id="panel-guitar" aria-labelledby="tab-guitar" hidden></div>
    </div>`;

  const lcd = stage.querySelector<HTMLOutputElement>('.lcd')!;
  const tabs = [...stage.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const pianoPanel = stage.querySelector<HTMLElement>('#panel-piano')!;
  const guitarPanel = stage.querySelector<HTMLElement>('#panel-guitar')!;

  let tab: 'piano' | 'guitar' = 'piano';
  let inView = false;
  const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting));
  io.observe(stage);

  const showNote = (midi: number) => (lcd.textContent = `${noteName(midi)} · ${midiToFreq(midi).toFixed(1)} Hz`);
  const stopPiano = mountPiano(pianoPanel, { onNote: showNote, isActive: () => inView && tab === 'piano' });
  const stopGuitar = mountGuitar(guitarPanel, { onNote: showNote, onLabel: (s) => (lcd.textContent = s) });

  const select = (btn: HTMLButtonElement) => {
    tab = btn.id === 'tab-guitar' ? 'guitar' : 'piano';
    tabs.forEach((t) => {
      const on = t === btn;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    pianoPanel.hidden = tab !== 'piano';
    guitarPanel.hidden = tab !== 'guitar';
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });

  const stopViz = mountVisualizer(stage.querySelector<HTMLCanvasElement>('.viz')!);
  const stopHud = mountHud(hud);

  return () => {
    io.disconnect();
    stopPiano();
    stopGuitar();
    stopViz();
    stopHud();
    stage.replaceChildren();
  };
}
