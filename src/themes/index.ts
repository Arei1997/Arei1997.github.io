import { pad } from '../lib/dom';

export type ThemeId = 'garage' | 'arcade' | 'studio';

export const THEME_IDS: readonly ThemeId[] = ['garage', 'arcade', 'studio'];

export const SECTIONS = ['about', 'experience', 'projects', 'skills', 'contact'] as const;
export type SectionId = (typeof SECTIONS)[number];

export const SECTION_TITLES: Record<SectionId, string> = {
  about: 'About me',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  contact: 'Contact',
};

export interface MountContext {
  /** The hero panel that holds the theme's interactive centrepiece. */
  stage: HTMLElement;
  /** Fixed overlay layer for HUD widgets. */
  hud: HTMLElement;
}

export interface ThemeModule {
  /** Builds the theme's interactive pieces and returns a cleanup function. */
  mount(ctx: MountContext): () => void;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  interest: string;
  icon: string;
  heroKicker: string;
  ctaPrimary: string;
  stageLabel: string;
  stageHint: string;
  contactTitle: string;
  kicker(index: number, section: SectionId): string;
  jobLabel(index: number, total: number): string;
  projectLabel(index: number): string;
  load(): Promise<ThemeModule>;
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

const ICONS: Record<ThemeId, string> = {
  garage: svg(
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M3.3 10.5h6.2M14.5 10.5h6.2M12 14.5V21"/>',
  ),
  arcade: svg(
    '<path d="M6.5 8h11A4.5 4.5 0 0 1 22 12.5v1a3.5 3.5 0 0 1-6.3 2.1L14.5 14h-5l-1.2 1.6A3.5 3.5 0 0 1 2 13.5v-1A4.5 4.5 0 0 1 6.5 8z"/><path d="M7 10.5v3M5.5 12h3"/><circle cx="15.8" cy="11.2" r=".6"/><circle cx="17.8" cy="13" r=".6"/>',
  ),
  studio: svg(
    '<path d="M9 18V5.5l11-2.3v12.6"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15.8" r="2.5"/>',
  ),
};

const GARAGE: Record<SectionId, string> = {
  about: 'Driver profile',
  experience: 'Race history',
  projects: 'The builds',
  skills: 'Spec sheet',
  contact: 'Pit lane',
};
const ARCADE: Record<SectionId, string> = {
  about: 'Player profile',
  experience: 'Quest log',
  projects: 'Levels cleared',
  skills: 'Skill tree',
  contact: 'Multiplayer',
};
const STUDIO: Record<SectionId, string> = {
  about: 'Liner notes',
  experience: 'On tour',
  projects: 'Discography',
  skills: 'Instruments',
  contact: 'Encore',
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  garage: {
    id: 'garage',
    name: 'Garage',
    interest: 'Cars',
    icon: ICONS.garage,
    heroKicker: 'Engineered for performance',
    ctaPrimary: 'See the builds',
    stageLabel: 'Interactive wind tunnel',
    stageHint:
      'Move your cursor through the tunnel to release smoke. Change the body, air speed and Reynolds number to watch the flow regime, drag and downforce respond — and hold the rev counter to fire up a Mustang 5.0 V8.',
    contactTitle: "Let's build something fast.",
    kicker: (i, s) => `${pad(i + 1)} — ${GARAGE[s]}`,
    jobLabel: (i, total) => `Stint ${pad(total - i)}`,
    projectLabel: (i) => `Build ${pad(i + 1)}`,
    load: () => import('./garage'),
  },
  arcade: {
    id: 'arcade',
    name: 'Arcade',
    interest: 'Gaming',
    icon: ICONS.arcade,
    heroKicker: 'Player one — ready',
    ctaPrimary: 'Select a level',
    stageLabel: 'Playable mini-game',
    stageHint:
      'Time Runner: click the game, then press Space (or tap) to jump — hold for a higher jump. Run from the molten early Earth through the dinosaurs to the far future. Achievements unlock as you explore.',
    contactTitle: 'Ready for co-op?',
    kicker: (i, s) => `World 1-${i + 1} · ${ARCADE[s]}`,
    jobLabel: (i, total) => `Quest ${pad(total - i)}`,
    projectLabel: (i) => `Cartridge ${pad(i + 1)}`,
    load: () => import('./arcade'),
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    interest: 'Music',
    icon: ICONS.studio,
    heroKicker: 'Now playing',
    ctaPrimary: 'Browse the discography',
    stageLabel: 'Mini music studio',
    stageHint:
      'A mini DAW: hit play (or Space), paint beats in the channel rack and melodies in the piano roll, or load a pattern. Arm record and jam on the Keys (A W S E D…) or Guitar tab to lay notes straight into the loop.',
    contactTitle: "Let's make something together.",
    kicker: (i, s) => `Track ${pad(i + 1)} · ${STUDIO[s]}`,
    jobLabel: (i) => `Side ${String.fromCharCode(65 + i)}`,
    projectLabel: (i) => `LP ${pad(i + 1)}`,
    load: () => import('./studio'),
  },
};

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
