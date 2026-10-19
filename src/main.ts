import './styles/base.css';
import './styles/garage.css';
import './styles/arcade.css';
import './styles/studio.css';

import { prefersReducedMotion } from './lib/dom';
import { observeSections, onSectionChange } from './lib/sections';
import { store } from './lib/storage';
import { renderFooter, renderHero, renderSections, renderTopbar } from './render';
import { SECTIONS, THEMES, THEME_IDS, isThemeId, type ThemeId } from './themes';

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => { updateCallbackDone: Promise<void> };
};

const root = document.documentElement;
const topbar = document.querySelector<HTMLElement>('.topbar')!;
const hero = document.querySelector<HTMLElement>('#top')!;
const sections = document.querySelector<HTMLElement>('#sections')!;
const footer = document.querySelector<HTMLElement>('.footer')!;
const hud = document.querySelector<HTMLElement>('#hud')!;

let active: ThemeId | null = null;
let unmount: (() => void) | null = null;
let unobserve: (() => void) | null = null;
// Guards against a slow theme chunk mounting after the user has already switched again.
let generation = 0;

function initialTheme(): ThemeId {
  const fromUrl = new URLSearchParams(location.search).get('theme');
  if (isThemeId(fromUrl)) return fromUrl;
  const saved = store.get<unknown>('theme', null);
  return isThemeId(saved) ? saved : 'garage';
}

function render(id: ThemeId, revealed: boolean) {
  unmount?.();
  unmount = null;
  unobserve?.();
  hud.replaceChildren();

  root.dataset.theme = id;
  renderHero(hero, THEMES[id]);
  renderSections(sections, THEMES[id], revealed);
  topbar.querySelectorAll<HTMLElement>('[data-switch-theme]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.switchTheme === id));
  });
  unobserve = observeSections(SECTIONS);
}

async function setTheme(id: ThemeId, animate: boolean) {
  if (id === active) return;
  const isFirst = active === null;
  active = id;
  const gen = ++generation;

  store.set('theme', id);
  const visited = new Set(store.get<string[]>('themes:visited', []));
  visited.add(id);
  store.set('themes:visited', [...visited]);

  if (!isFirst) {
    const url = new URL(location.href);
    url.searchParams.set('theme', id);
    history.replaceState(null, '', url);
  }

  const doc = document as ViewTransitionDoc;
  const swap = () => render(id, !isFirst);
  if (animate && doc.startViewTransition && !prefersReducedMotion()) {
    await doc.startViewTransition(swap).updateCallbackDone;
  } else {
    swap();
  }
  // Sections are rendered by JS, so the browser's own jump to a #hash on load finds nothing.
  if (isFirst && location.hash) {
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'instant' });
  }

  const mod = await THEMES[id].load();
  if (gen !== generation) return;
  unmount = mod.mount({ stage: hero.querySelector<HTMLElement>('.stage')!, hud });
}

function wireTopbar() {
  const menuBtn = topbar.querySelector<HTMLButtonElement>('.menu-btn')!;
  const mobileNav = topbar.querySelector<HTMLElement>('#mobile-nav')!;
  const setMenu = (open: boolean) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileNav.hidden = !open;
  };
  menuBtn.addEventListener('click', () => setMenu(!!mobileNav.hidden));
  mobileNav.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) setMenu(false);
  });

  onSectionChange(({ id }) => {
    topbar.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => {
      if (a.dataset.nav === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  });
}

document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLElement>('[data-switch-theme]');
  const id = btn?.dataset.switchTheme;
  if (!isThemeId(id)) return;
  // The view transition expands from wherever the click happened.
  root.style.setProperty('--vt-x', `${e.clientX}px`);
  root.style.setProperty('--vt-y', `${e.clientY}px`);
  void setTheme(id, true);
});

renderTopbar(topbar);
renderFooter(footer);
wireTopbar();
void setTheme(initialTheme(), false);

// Warm the other theme chunks so switching is instant.
const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
idle(() => THEME_IDS.forEach((id) => void THEMES[id].load()));
