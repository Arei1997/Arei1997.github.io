import { audioIfReady } from '../lib/audio';
import { esc } from '../lib/dom';
import { currentSection, onSectionChange, scrollProgress, type SectionChange } from '../lib/sections';
import { store } from '../lib/storage';

interface Achievement {
  id: string;
  title: string;
  desc: string;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'about', title: 'Background Check', desc: 'Read the About section' },
  { id: 'experience', title: 'Quest Log', desc: 'Review the work history' },
  { id: 'projects', title: 'Loot Inspector', desc: 'Browse the projects' },
  { id: 'skills', title: 'Skill Tree', desc: 'Check out the skills' },
  { id: 'contact', title: 'Party Invite', desc: 'Reach the contact section' },
  { id: 'play', title: 'Insert Coin', desc: 'Start the mini-game' },
  { id: 'score', title: 'High Scorer', desc: 'Score 500+ in the mini-game' },
  { id: 'extinction', title: 'Extinction Survivor', desc: 'Outrun the asteroid into the Ice Age' },
  { id: 'future', title: 'Back to the Future', desc: 'Reach the Space Age' },
  { id: 'explorer', title: 'World Traveller', desc: 'Visit all three themes' },
  { id: 'konami', title: 'Old School', desc: '↑ ↑ ↓ ↓ ← → ← → B A' },
];

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const STORE_KEY = 'arcade:achievements';

export interface AchievementTracker {
  unlock(id: string): void;
  destroy(): void;
}

export function mountAchievements(hud: HTMLElement): AchievementTracker {
  const unlocked = new Set(store.get<string[]>(STORE_KEY, []));
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const xp = document.createElement('div');
  xp.className = 'xp';
  xp.innerHTML = '<div class="xp-fill"></div>';

  const dock = document.createElement('div');
  dock.className = 'ach-dock';
  dock.innerHTML = `
    <div class="ach-panel" id="ach-panel" hidden>
      <p class="ach-heading">Achievements</p>
      <ul class="ach-list"></ul>
    </div>
    <button type="button" class="ach-toggle" aria-expanded="false" aria-controls="ach-panel">
      <span class="ach-level"></span><span class="ach-count"></span>
    </button>`;

  const toasts = document.createElement('div');
  toasts.className = 'toasts';
  toasts.setAttribute('aria-live', 'polite');
  hud.append(xp, dock, toasts);

  const fill = xp.querySelector<HTMLElement>('.xp-fill')!;
  const panel = dock.querySelector<HTMLElement>('.ach-panel')!;
  const list = dock.querySelector<HTMLElement>('.ach-list')!;
  const toggle = dock.querySelector<HTMLButtonElement>('.ach-toggle')!;
  const level = dock.querySelector<HTMLElement>('.ach-level')!;
  const count = dock.querySelector<HTMLElement>('.ach-count')!;

  function renderPanel() {
    list.innerHTML = ACHIEVEMENTS.map((a) => {
      const got = unlocked.has(a.id);
      return `<li class="${got ? 'got' : ''}"><span class="ach-icon" aria-hidden="true">${got ? '★' : '?'}</span><span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></span><span class="sr-only">${got ? 'unlocked' : 'locked'}</span></li>`;
    }).join('');
    count.textContent = `★ ${unlocked.size}/${ACHIEVEMENTS.length}`;
  }

  function chime() {
    const g = audioIfReady();
    if (!g) return;
    [1046.5, 1318.5, 1568].forEach((f, i) => {
      const t = g.ctx.currentTime + i * 0.07;
      const osc = g.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const amp = g.ctx.createGain();
      amp.gain.setValueAtTime(0.05, t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(amp).connect(g.master);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  function unlock(id: string) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || unlocked.has(id)) return;
    unlocked.add(id);
    store.set(STORE_KEY, [...unlocked]);
    renderPanel();
    chime();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-kicker">Achievement unlocked</span><b>${esc(a.title)}</b>`;
    toasts.append(toast);
    later(() => toast.classList.add('out'), 2800);
    later(() => toast.remove(), 3300);
  }

  const showLevel = (s: SectionChange) => {
    level.textContent = `LV ${s.index + 2}`;
    if (s.index >= 0) unlock(s.id);
  };

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      fill.style.transform = `scaleX(${scrollProgress()})`;
    });
  };

  let konami = 0;
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    konami = key === KONAMI[konami] ? konami + 1 : key === KONAMI[0] ? 1 : 0;
    if (konami < KONAMI.length) return;
    konami = 0;
    unlock('konami');
    document.documentElement.classList.add('konami');
    later(() => document.documentElement.classList.remove('konami'), 6000);
  };

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!!panel.hidden));
  const onDocClick = (e: MouseEvent) => {
    if (!panel.hidden && !dock.contains(e.target as Node)) setOpen(false);
  };

  renderPanel();
  showLevel(currentSection());
  onScroll();
  const offSection = onSectionChange(showLevel);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('keydown', onKey);
  document.addEventListener('click', onDocClick);
  if (store.get<string[]>('themes:visited', []).length >= 3) later(() => unlock('explorer'), 900);

  return {
    unlock,
    destroy() {
      offSection();
      removeEventListener('scroll', onScroll);
      removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.documentElement.classList.remove('konami');
      xp.remove();
      dock.remove();
      toasts.remove();
    },
  };
}
