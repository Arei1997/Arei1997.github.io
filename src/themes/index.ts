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
  stageLabel: string;
  stageHint: string;
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

export const THEMES: Record<ThemeId, ThemeDef> = {
  garage: {
    id: 'garage',
    name: 'Garage',
    interest: 'Cars',
    icon: ICONS.garage,
    stageLabel: 'Interactive wind tunnel',
    stageHint: 'Move the cursor through the tunnel to trail smoke. Hold the rev counter to start the V8.',
    load: () => import('./garage'),
  },
  arcade: {
    id: 'arcade',
    name: 'Arcade',
    interest: 'Gaming',
    icon: ICONS.arcade,
    stageLabel: 'Playable mini-game',
    stageHint: 'Click the game, then press Space or tap to jump. Hold it to jump higher.',
    load: () => import('./arcade'),
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    interest: 'Music',
    icon: ICONS.studio,
    stageLabel: 'Mini music studio',
    stageHint: 'Press play, then click squares to write a beat. The Keys and Guitar tabs are playable too.',
    load: () => import('./studio'),
  },
};

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
