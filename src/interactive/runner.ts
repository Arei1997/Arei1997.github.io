import { audio, audioIfReady } from '../lib/audio';
import { visibleLoop } from '../lib/dom';
import { store } from '../lib/storage';

const W = 320;
const H = 160;
const GROUND = 134;
const GRAVITY = 1150;
const JUMP_V = -340;
const SHORT_HOP_V = -140;
const PLAYER_X = 36;
const PLAYER_W = 12;
const PLAYER_H = 14;
/** Scenery wraps over this width; props may be up to SCENERY_MARGIN wide without popping at the edges. */
const SCENERY_W = 600;
const SCENERY_MARGIN = 140;

const PALETTE: Record<string, string> = {
  c: '#00e5ff', m: '#ff2bd6', w: '#ffffff', k: '#0a0820', r: '#ff4d6d', g: '#39ff14', y: '#ffd23f',
  p: '#7a5cff', P: '#c77dff', o: '#ff8c1a', R: '#b3261e', l: '#ff5400', e: '#6c6f7d', s: '#c0c7d1',
  t: '#e9c46a', b: '#8b5a2b', G: '#2d9a5f', i: '#a8dcff', a: '#ffb703',
};

interface SpriteDef {
  frames: string[][];
  /** Hitbox [x, y, w, h] within the sprite; defaults to the whole sprite inset by 1px. */
  hit?: [number, number, number, number];
}

const ROBOT_TOP = [
  '....cccc....',
  '...cccccc...',
  '..cwkccwkc..',
  '..cwwccwwc..',
  '...cccccc...',
  '....cccc....',
  '..mmmmmmmm..',
  '.m.mmyymm.m.',
  '...mmmmmm...',
  '...mmmmmm...',
];

const SPRITES = {
  run: {
    frames: [
      [...ROBOT_TOP, '...pp..pp...', '..pp....pp..', '.pp......pp.', '............'],
      [...ROBOT_TOP, '....pppp....', '....p..p....', '....p..p....', '...pp..pp...'],
    ],
  },
  air: { frames: [[...ROBOT_TOP, '..pppppppp..', '..p......p..', '............', '............']] },

  lavaRock: {
    frames: [['...RRRR...', '..RlllRR..', '.RlloolRR.', 'RRlooyolRR', 'RlooyyoolR', 'RRlooolRRR', '.RRlllRRR.', '..RRRRRR..']],
  },
  meteor: {
    frames: [['..ee..oo.y....', '.eeeeooolly...', 'eebeeeoolllyy.', 'eeeeeoolllyy..', '.eeeooolly....', '..ee..o.......']],
    hit: [0, 1, 7, 4],
  },
  zircon: { frames: [['...P...', '..PPP..', '.PPwPP.', 'PPPwPPP', '.PPPPP.', '..PPP..', '...P...']] },

  trilobite: {
    frames: [
      ['....tttt....', '..tbttttbt..', '.tttbttbttt.', 'tbtttbbtttbt', '.tttbttbttt.', '..tbttttbt..', '.t.t.tt.t.t.'],
      ['....tttt....', '..tbttttbt..', '.tttbttbttt.', 'tbtttbbtttbt', '.tttbttbttt.', '..tbttttbt..', 't.t.t..t.t.t'],
    ],
  },
  jelly: {
    frames: [
      ['...mmmm...', '.mmmmmmmm.', 'mmwmmmmwmm', 'mmmmmmmmmm', 'm.m.mm.m.m', 'm.m.m..m.m', '.m..m.m..m', '..m.m..m..', '.m...m..m.', '...m...m..'],
      ['..........', '...mmmm...', '..mmmmmm..', '.mmwmmwmm.', '.m.mmmm.m.', '.m.m..m.m.', '..m.m..m..', '.m..m.m..m', '..m..m..m.', '.m..m...m.'],
    ],
    hit: [1, 0, 8, 5],
  },
  shell: { frames: [['..ttt..', '.tbbbt.', 'tbtttbt', 'tbtbtbt', 'tbttbt.', '.tbbt..', '..tt...']] },

  millipede: {
    frames: [
      ['...bbbbbbbbbbb..', '..bobobobobobobb', '.bbbbbbbbbbbbbbb', 'kbbbbbbbbbbbbbb.', '.b.b.b.b.b.b.b..', 'b.b.b.b.b.b.b...'],
      ['...bbbbbbbbbbb..', '..bobobobobobobb', '.bbbbbbbbbbbbbbb', 'kbbbbbbbbbbbbbb.', 'b.b.b.b.b.b.b...', '.b.b.b.b.b.b.b..'],
    ],
  },
  dragonfly: {
    frames: [
      ['....iii..iii....', '...iiiiiiiiii...', 'kkGGGGGGGGGGGGGG', '................', '................'],
      ['................', '................', 'kkGGGGGGGGGGGGGG', '...iiiiiiiiii...', '....iii..iii....'],
    ],
    hit: [0, 1, 16, 3],
  },
  oxygen: { frames: [['..iii..', '.i...i.', 'i.w...i', 'i.....i', 'i.....i', '.i...i.', '..iii..']] },

  raptor: {
    frames: [
      ['..GGG.......', '.GkGGG......', '.GGGGGG.....', '....GGGG....', '....GGGGGG..', '...GGGGGGGGG', '...GGGGG..GG', '....G..G....', '...G...G....', '..GG..GG....'],
      ['..GGG.......', '.GkGGG......', '.GGGGGG.....', '....GGGG....', '....GGGGGG..', '...GGGGGGGGG', '...GGGGG..GG', '....G.G.....', '....G.G.....', '...GG.GG....'],
    ],
    hit: [1, 0, 10, 10],
  },
  pterosaur: {
    frames: [
      ['....bb....bb....', '.....bb..bb.....', 'kbbbbbbbbbbbbb..', '....tbbbbbt.....', '................'],
      ['................', '................', 'kbbbbbbbbbbbbb..', '....tbbbbbbt....', '...bb......bb...'],
    ],
    hit: [0, 2, 14, 2],
  },
  amber: { frames: [['..aaa..', '.aaaaa.', 'aaakaaa', 'aakkkaa', 'aaakaaa', '.aaaaa.', '..aaa..']] },

  mammoth: {
    frames: [
      ['....bbbbbb....', '..bbbbbbbbbb..', '.bbkbbbbbbbbb.', 'bbbbbbbbbbbbbb', 'wbbbbbbbbbbbbb', 'ww.bbbbbbbbbbb', '.w.bbbbbbbbbbb', '...bb.bb.bb.bb', '...bb.bb.bb.bb'],
      ['....bbbbbb....', '..bbbbbbbbbb..', '.bbkbbbbbbbbb.', 'bbbbbbbbbbbbbb', 'wbbbbbbbbbbbbb', 'ww.bbbbbbbbbbb', '.w.bbbbbbbbbbb', '..bb.bb.bb.bb.', '..bb.bb.bb.bb.'],
    ],
    hit: [1, 1, 13, 8],
  },
  owl: {
    frames: [
      ['ww........ww', '.www....www.', '..wwwwwwww..', '...wkwwkw...', '....wwww....'],
      ['............', '............', '..wwwwwwww..', '..wwkwwkww..', 'ww..wwww..ww'],
    ],
    hit: [1, 2, 10, 3],
  },
  snowflake: { frames: [['...i...', '.i.i.i.', '..iii..', 'iiiwiii', '..iii..', '.i.i.i.', '...i...']] },

  bug: {
    frames: [['.r......r.', '..r....r..', '...rrrr...', '.rrwrrwrr.', 'rrrkrrkrrr', '.rrrrrrrr.', 'r.r.rr.r.r', 'r.r....r.r']],
  },
  drone: {
    frames: [['..pppppppppp..', '.pmmmmmmmmmmp.', 'ppmwmmmmmmwmpp', '.pmmmmmmmmmmp.', '..p..y..y..p..', '..............']],
    hit: [0, 0, 14, 5],
  },
  commit: { frames: [['...g...', '..ggg..', '.ggwgg.', 'ggwwwgg', '.ggwgg.', '..ggg..', '...g...']] },

  alien: {
    frames: [['..g....g..', '...g..g...', '..gggggg..', '.gwkggwkg.', 'gggggggggg', 'gg.gggg.gg', 'g.gg..gg.g']],
  },
  ufo: {
    frames: [['.....cccc.....', '....cwwwwc....', '..ssssssssss..', 'sssysssysssyss', '..ssssssssss..', '....m....m....']],
    hit: [0, 2, 14, 3],
  },
  cell: { frames: [['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'y.....y']] },
} satisfies Record<string, SpriteDef>;

type SpriteId = keyof typeof SPRITES;
type Scenery = 'volcanoes' | 'reef' | 'ferns' | 'jungle' | 'glaciers' | 'city' | 'planets';
type Weather = 'embers' | 'bubbles' | 'spores' | 'snow' | 'stars' | 'warp' | 'none';

interface Era {
  name: string;
  when: string;
  note?: string;
  sky: [string, string];
  far: string;
  accent: string;
  ground: string;
  edge: string;
  dash: string;
  scenery: Scenery;
  weather: Weather;
  foe: SpriteId;
  flyer: SpriteId;
  pickup: SpriteId;
  /** Distance run (px) at which this era begins. */
  start: number;
}

export const ERAS: Era[] = [
  {
    name: 'Hadean', when: '4.5 billion years ago',
    sky: ['#2b0505', '#7a1d0c'], far: '#3d0b06', accent: '#ff5400',
    ground: '#2a0d08', edge: '#ff5400', dash: '#7a1d0c',
    scenery: 'volcanoes', weather: 'embers', foe: 'lavaRock', flyer: 'meteor', pickup: 'zircon', start: 0,
  },
  {
    name: 'Cambrian Seas', when: '541 million years ago',
    sky: ['#021a33', '#0a4d6e'], far: '#06314a', accent: '#ff7aa2',
    ground: '#3b3424', edge: '#e9c46a', dash: '#6b5b3a',
    scenery: 'reef', weather: 'bubbles', foe: 'trilobite', flyer: 'jelly', pickup: 'shell', start: 1500,
  },
  {
    name: 'Carboniferous', when: '330 million years ago',
    sky: ['#0f2414', '#3d6b3a'], far: '#16361d', accent: '#7fbf5a',
    ground: '#1d2b12', edge: '#6ea043', dash: '#34501f',
    scenery: 'ferns', weather: 'spores', foe: 'millipede', flyer: 'dragonfly', pickup: 'oxygen', start: 3300,
  },
  {
    name: 'Jurassic', when: '150 million years ago',
    sky: ['#3a1c46', '#f28e5b'], far: '#3b2233', accent: '#ffb26b',
    ground: '#3a2a1a', edge: '#c98b4e', dash: '#5c4128',
    scenery: 'jungle', weather: 'none', foe: 'raptor', flyer: 'pterosaur', pickup: 'amber', start: 5400,
  },
  {
    name: 'Ice Age', when: '20,000 years ago', note: 'You survived the asteroid!',
    sky: ['#0e1a33', '#5f86b5'], far: '#a9c6e8', accent: '#ffffff',
    ground: '#dfeaf5', edge: '#ffffff', dash: '#a9c6e8',
    scenery: 'glaciers', weather: 'snow', foe: 'mammoth', flyer: 'owl', pickup: 'snowflake', start: 7800,
  },
  {
    name: 'Today', when: 'The present day',
    sky: ['#07051a', '#1f1650'], far: '#1a1446', accent: '#ffd23f',
    ground: '#0b0820', edge: '#ff2bd6', dash: '#2a1f6b',
    scenery: 'city', weather: 'stars', foe: 'bug', flyer: 'drone', pickup: 'commit', start: 10400,
  },
  {
    name: 'Space Age', when: 'The year 2300',
    sky: ['#000000', '#120a2e'], far: '#2a1b5c', accent: '#00e5ff',
    ground: '#05030f', edge: '#00e5ff', dash: '#7a5cff',
    scenery: 'planets', weather: 'warp', foe: 'alien', flyer: 'ufo', pickup: 'cell', start: 13200,
  },
];

/** Index of the era that ends the dinosaurs — the run shows the asteroid coming before it. */
const IMPACT_ERA = 4;

interface Prop {
  x: number;
  w: number;
  h: number;
  seed: number;
}

interface Thing {
  sprite: SpriteId;
  role: 'foe' | 'flyer' | 'pickup';
  x: number;
  y: number;
  bob: number;
  phase: number;
  taken: boolean;
}

interface Mote {
  x: number;
  y: number;
  v: number;
  s: number;
}

/** Small deterministic PRNG (mulberry32) so scenery is identical on every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeProps(era: Era, index: number): Prop[] {
  const rand = seeded(index * 97 + 13);
  const spec: Record<Scenery, [count: number, minW: number, maxW: number, minH: number, maxH: number]> = {
    volcanoes: [5, 60, 120, 30, 64],
    reef: [26, 2, 2, 14, 50],
    ferns: [13, 3, 3, 34, 76],
    jungle: [12, 3, 3, 30, 60],
    glaciers: [7, 70, 140, 30, 74],
    city: [26, 14, 34, 16, 66],
    planets: [9, 3, 6, 20, 60],
  };
  const [count, minW, maxW, minH, maxH] = spec[era.scenery];
  return Array.from({ length: count }, (_, i) => ({
    x: (i / count) * SCENERY_W + rand() * (SCENERY_W / count) * 0.6,
    w: Math.round(minW + rand() * (maxW - minW)),
    h: Math.round(minH + rand() * (maxH - minH)),
    seed: Math.floor(rand() * 1e6),
  }));
}

function buildSprite(rows: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, i) => {
      if (!PALETTE[ch]) return;
      x.fillStyle = PALETTE[ch];
      x.fillRect(i, y, 1, 1);
    }),
  );
  return c;
}

export function mountRunner(stage: HTMLElement): () => void {
  stage.innerHTML = `
    <div class="runner">
      <canvas width="${W}" height="${H}" tabindex="0" aria-label="Time Runner mini-game. Press Space or tap to jump; run from the molten early Earth to the far future."></canvas>
      <div class="runner-bar">
        <span>Score <b data-score>0</b></span>
        <span>Best <b data-best>0</b></span>
        <span class="runner-era"><b data-era>${ERAS[0].name}</b></span>
        <span class="era-track" aria-hidden="true">${ERAS.map((e) => `<i title="${e.name}"></i>`).join('')}</span>
      </div>
    </div>`;

  const canvas = stage.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const scoreEl = stage.querySelector<HTMLElement>('[data-score]')!;
  const bestEl = stage.querySelector<HTMLElement>('[data-best]')!;
  const eraEl = stage.querySelector<HTMLElement>('[data-era]')!;
  const trackDots = [...stage.querySelectorAll<HTMLElement>('.era-track i')];

  const sprites = Object.fromEntries(
    Object.entries(SPRITES).map(([id, def]) => [id, def.frames.map(buildSprite)]),
  ) as Record<SpriteId, HTMLCanvasElement[]>;
  const hitbox = (id: SpriteId): [number, number, number, number] => {
    const def: SpriteDef = SPRITES[id];
    const c = sprites[id][0];
    return def.hit ?? [1, 1, c.width - 2, c.height - 1];
  };
  const props = ERAS.map(makeProps);
  const skies = ERAS.map((era) => {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, era.sky[0]);
    g.addColorStop(1, era.sky[1]);
    return g;
  });

  let state: 'ready' | 'running' | 'over' = 'ready';
  let y = GROUND - PLAYER_H, vy = 0, grounded = true;
  let speed = 150, dist = 0, pickups = 0, nextSpawn = 120, t = 0;
  let eraIndex = 0, prevEra = -1, eraFade = 1, banner = 0;
  let flash = 0, flashColour = '255, 77, 109', shake = 0, overAt = 0;
  let things: Thing[] = [];
  let motes: Mote[] = [];
  let best = store.get<number>('arcade:best', 0);
  bestEl.textContent = String(best);

  const score = () => Math.floor(dist / 8) + pickups * 50;
  const era = () => ERAS[eraIndex];

  function blip(freq: number, dur: number, type: OscillatorType = 'square', slideTo?: number) {
    const g = audioIfReady();
    if (!g) return;
    const now = g.ctx.currentTime;
    const osc = g.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    const amp = g.ctx.createGain();
    amp.gain.setValueAtTime(0.05, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp).connect(g.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function resetWeather() {
    motes = Array.from({ length: 42 }, () => ({
      x: Math.random() * W,
      y: Math.random() * GROUND,
      v: 0.5 + Math.random(),
      s: Math.random() < 0.25 ? 2 : 1,
    }));
  }

  function showEra() {
    eraEl.textContent = era().name;
    trackDots.forEach((dot, i) => dot.classList.toggle('on', i <= eraIndex));
  }

  function enterEra(index: number) {
    prevEra = eraIndex;
    eraIndex = index;
    eraFade = 0;
    banner = 2.6;
    // Clear the runway so the banner isn't read under pressure.
    things = things.filter((th) => th.x < W * 0.55);
    nextSpawn = Math.max(nextSpawn, 220);
    if (index === IMPACT_ERA) {
      flash = 1.4;
      flashColour = '255, 170, 80';
      shake = 0.9;
      blip(90, 0.9, 'sawtooth', 30);
    } else {
      flash = 0.6;
      flashColour = '255, 255, 255';
      blip(523, 0.1);
      blip(784, 0.18);
    }
    resetWeather();
    showEra();
  }

  function reset() {
    y = GROUND - PLAYER_H;
    vy = 0;
    grounded = true;
    speed = 150;
    dist = 0;
    pickups = 0;
    nextSpawn = 120;
    things = [];
    eraIndex = 0;
    prevEra = -1;
    eraFade = 1;
    banner = 2.2;
    scoreEl.textContent = '0';
    resetWeather();
    showEra();
  }

  function jump() {
    if (!grounded) return;
    vy = JUMP_V;
    grounded = false;
    blip(420, 0.12, 'square', 840);
  }

  function press() {
    audio();
    if (state === 'ready') {
      reset();
      state = 'running';
    } else if (state === 'over') {
      if (performance.now() - overAt < 450) return;
      reset();
      state = 'running';
    } else {
      jump();
    }
  }

  // Letting go early cuts the jump short, so taps are small hops and holds are full jumps.
  function release() {
    if (vy < SHORT_HOP_V) vy = SHORT_HOP_V;
  }

  function addThing(sprite: SpriteId, role: Thing['role'], x: number, yTop: number, bob = 0) {
    things.push({ sprite, role, x, y: yTop, bob, phase: Math.random() * 6, taken: false });
  }

  function spawn() {
    const e = era();
    const airChance = dist < 300 ? 0 : 0.22 + eraIndex * 0.03;
    let width = 0;
    if (Math.random() < airChance) {
      const [, hy, , hh] = hitbox(e.flyer);
      const bob = e.flyer === 'jelly' ? 3 : 0;
      // Hitbox bottom sits 18px above the ground: you clear it standing, and hit it if you jump.
      addThing(e.flyer, 'flyer', W + 10, GROUND - 18 - (hy + hh) - bob, bob);
      width = sprites[e.flyer][0].width;
    } else {
      const foe = sprites[e.foe][0];
      addThing(e.foe, 'foe', W + 10, GROUND - foe.height);
      width = foe.width;
      if (Math.random() < 0.4) addThing(e.pickup, 'pickup', W + 10 + Math.floor(width / 2) - 3, GROUND - 46, 1.5);
    }
    if (Math.random() < 0.15) addThing(e.pickup, 'pickup', W + 90, GROUND - 22, 1.5);
    nextSpawn = (110 + Math.random() * 130) * Math.sqrt(speed / 150) + width;
  }

  function gameOver() {
    state = 'over';
    overAt = performance.now();
    flash = 1;
    flashColour = '255, 77, 109';
    const s = score();
    if (s > best) {
      best = s;
      store.set('arcade:best', best);
      bestEl.textContent = String(best);
    }
    blip(300, 0.4, 'sawtooth', 60);
  }

  const bobOffset = (th: Thing) => (th.bob ? Math.round(Math.sin(t * 5 + th.phase) * th.bob) : 0);

  function updateWeather(dt: number) {
    const w = era().weather;
    const drift = speed * dt;
    for (const m of motes) {
      if (w === 'embers') { m.y -= 22 * m.v * dt; m.x -= drift * 0.4; }
      else if (w === 'bubbles') { m.y -= 26 * m.v * dt; m.x += Math.sin(t * 3 + m.v * 9) * 0.3 - drift * 0.2; }
      else if (w === 'spores') { m.y += Math.sin(t + m.v * 7) * 0.2; m.x -= drift * 0.15 * m.v; }
      else if (w === 'snow') { m.y += 30 * m.v * dt; m.x -= drift * 0.35 * m.v; }
      else if (w === 'stars') { m.x -= drift * 0.05 * m.v; }
      else if (w === 'warp') { m.x -= drift * 2.5 * m.v; }
      if (m.y < 0) m.y = GROUND;
      if (m.y > GROUND) m.y = 0;
      if (m.x < -8) m.x = W + 4;
      if (m.x > W + 8) m.x = 0;
    }
  }

  function update(dt: number) {
    t += dt;
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt);
    banner = Math.max(0, banner - dt);
    eraFade = Math.min(1, eraFade + dt / 1.2);
    updateWeather(state === 'running' ? dt : dt * 0.3);
    if (state !== 'running') return;

    speed = Math.min(330, speed + 4 * dt);
    const dx = speed * dt;
    dist += dx;
    nextSpawn -= dx;
    if (nextSpawn <= 0) spawn();
    const next = ERAS[eraIndex + 1];
    if (next && dist >= next.start) enterEra(eraIndex + 1);

    vy += GRAVITY * dt;
    y += vy * dt;
    if (y >= GROUND - PLAYER_H) {
      y = GROUND - PLAYER_H;
      vy = 0;
      grounded = true;
    }

    const left = PLAYER_X + 2, right = PLAYER_X + PLAYER_W - 2, top = y + 2, bottom = y + PLAYER_H;
    for (const th of things) {
      th.x -= dx;
      const [hx, hy, hw, hh] = hitbox(th.sprite);
      const tx = th.x + hx, ty = th.y + bobOffset(th) + hy;
      if (right < tx || left > tx + hw || bottom < ty || top > ty + hh) continue;
      if (th.role === 'pickup') {
        th.taken = true;
        pickups++;
        blip(988, 0.08);
        blip(1319, 0.12);
      } else {
        gameOver();
        return;
      }
    }
    things = things.filter((th) => !th.taken && th.x + 20 > 0);

    scoreEl.textContent = String(score());
  }

  // ---------- Drawing ----------

  const rect = (x: number, yy: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(x), Math.round(yy), w, h);
  };

  /** Pixel-row triangle (mountain / volcano); rows above `capFrom` (0–1 of height) use the cap colour. */
  function mountain(cx: number, w: number, h: number, colour: string, seed: number, jag = 0, cap?: string, capFrom = 0.65) {
    for (let r = 0; r < h; r++) {
      const half = (w / 2) * (1 - r / h) * (1 + jag * Math.sin(r * 0.9 + seed));
      rect(cx - half, GROUND - r - 1, Math.max(1, Math.round(half * 2)), 1, cap && r > h * capFrom ? cap : colour);
    }
  }

  function disc(cx: number, cy: number, r: number, colour: string) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      rect(cx - half, cy + dy, half * 2 + 1, 1, colour);
    }
  }

  function frond(x: number, topY: number, h: number, colour: string, layers: number) {
    rect(x, topY, 2, h, colour);
    for (let j = 0; j < layers; j++) {
      const fy = topY + j * 4;
      for (let s = 1; s < 11 - j; s++) {
        const drop = Math.floor((s * s) / 14);
        rect(x - s, fy + drop, 1, 1, colour);
        rect(x + 1 + s, fy + drop, 1, 1, colour);
      }
    }
  }

  function drawScenery(index: number) {
    const e = ERAS[index];
    const offset = dist * 0.3;
    if (e.scenery === 'planets') {
      // A big ringed planet hangs in the sky, drifting far slower than the foreground.
      const px = W - 70 - ((dist * 0.02) % (W + 120)) + 60;
      disc(px, 38, 16, '#3b2a7a');
      disc(px - 4, 34, 9, '#4d3a9a');
      for (let k = -30; k <= 30; k++) rect(px + k, 38 + Math.round(k * 0.18), 1, 1, e.accent);
    }
    props[index].forEach((p, slot) => {
      const x = ((((p.x - offset) % SCENERY_W) + SCENERY_W) % SCENERY_W) - SCENERY_MARGIN;
      switch (e.scenery) {
        case 'volcanoes':
          mountain(x, p.w, p.h, e.far, p.seed);
          rect(x - 4, GROUND - p.h, 8, 2, e.accent);
          for (let k = 0; k < p.h * 0.6; k++) rect(x - 1 + Math.round(Math.sin(k * 0.3 + p.seed) * 1.5), GROUND - p.h + k, 1, 1, e.accent);
          break;
        case 'reef':
          for (let k = 0; k < p.h; k += 2) {
            const sway = Math.round(Math.sin(t * 1.8 + p.seed + k * 0.18) * 2);
            rect(x + sway, GROUND - k - 2, 2, 2, e.far);
          }
          if (slot % 3 === 0) disc(x, GROUND - 4, 3 + (p.seed % 3), e.accent);
          break;
        case 'ferns':
          frond(x, GROUND - p.h, p.h, e.far, 5);
          break;
        case 'jungle':
          if (slot % 4 === 0) {
            mountain(x, 120, 58, e.far, p.seed);
            rect(x - 4, GROUND - 58, 8, 2, e.accent);
          } else {
            frond(x, GROUND - p.h, p.h, '#24121f', 3);
          }
          break;
        case 'glaciers':
          mountain(x, p.w, p.h, '#7f9fc4', p.seed, 0.12, e.far, 0.55);
          break;
        case 'city': {
          rect(x, GROUND - p.h, p.w, p.h, e.far);
          const lit = seeded(p.seed);
          for (let wy = GROUND - p.h + 3; wy < GROUND - 3; wy += 4) {
            for (let wx = x + 2; wx < x + p.w - 2; wx += 4) if (lit() < 0.3) rect(wx, wy, 1, 1, e.accent);
          }
          break;
        }
        case 'planets':
          if (slot % 3 === 0) {
            disc(x, 70 + (p.seed % 24), 3 + (p.seed % 3), '#5b4fa8');
          } else {
            rect(x, GROUND - p.h, p.w, p.h, e.far);
            rect(x, GROUND - p.h, p.w, 1, e.accent);
          }
          break;
      }
    });
  }

  function drawBackdrop(index: number) {
    ctx.fillStyle = skies[index];
    ctx.fillRect(0, 0, W, GROUND);
    drawScenery(index);
  }

  function drawWeather() {
    const w = era().weather;
    if (w === 'none') return;
    for (const m of motes) {
      if (w === 'warp') {
        rect(m.x, m.y, Math.round(4 + m.v * 6), 1, m.v > 1 ? '#9fefff' : '#5b4fa8');
        continue;
      }
      const colour =
        w === 'embers' ? (m.v > 1 ? '#ffd23f' : '#ff5400')
        : w === 'bubbles' ? '#a8dcff'
        : w === 'spores' ? '#d4f58c'
        : w === 'snow' ? '#ffffff'
        : '#5b4fa8';
      rect(m.x, m.y, m.s, m.s, colour);
    }
  }

  function text(s: string, ty: number, colour: string, size = 8) {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 8, 32, 0.85)';
    ctx.fillText(s, W / 2 + 1, ty + 1);
    ctx.fillStyle = colour;
    ctx.fillText(s, W / 2, ty);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 6 * shake), Math.round((Math.random() - 0.5) * 6 * shake));

    if (prevEra >= 0 && eraFade < 1) {
      drawBackdrop(prevEra);
      ctx.globalAlpha = eraFade;
    }
    drawBackdrop(eraIndex);
    ctx.globalAlpha = 1;

    // The asteroid that ends the Jurassic, growing as the impact approaches.
    if (eraIndex === IMPACT_ERA - 1 && state === 'running') {
      const k = 1 - (ERAS[IMPACT_ERA].start - dist) / 1100;
      if (k > 0) {
        const ax = W * (0.95 - k * 0.45), ay = 8 + k * 70, r = Math.round(2 + k * 6);
        for (let s = 1; s < 14; s++) rect(ax + s * 3, ay - s * 1.6, Math.max(1, r - s / 3), Math.max(1, r - s / 3), s < 5 ? '#ffd23f' : '#ff8c1a');
        disc(ax, ay, r, '#6c6f7d');
      }
    }

    drawWeather();

    const e = era();
    rect(0, GROUND, W, H - GROUND, e.ground);
    rect(0, GROUND, W, 1, e.edge);
    for (let x = -(dist % 16); x < W; x += 16) rect(x, GROUND + 6, 8, 1, e.dash);
    for (let x = -((dist * 1.5) % 24); x < W; x += 24) rect(x, GROUND + 15, 14, 1, e.dash);

    for (const th of things) {
      const frames = sprites[th.sprite];
      const frame = frames[Math.floor(t * 6 + th.phase) % frames.length];
      ctx.drawImage(frame, Math.floor(th.x), Math.floor(th.y) + bobOffset(th));
    }

    const runFrame = state === 'running' ? Math.floor(dist / 10) % 2 : Math.floor(t * 3) % 2;
    ctx.drawImage(grounded ? sprites.run[runFrame] : sprites.air[0], PLAYER_X, Math.floor(y));

    const blink = Math.floor(t * 2) % 2 === 0;
    if (state === 'ready') {
      text('TIME RUNNER', 40, '#00e5ff');
      text('4.5 BILLION YEARS. ONE JUMP BUTTON.', 56, '#ffffff', 6);
      if (blink) text(document.activeElement === canvas ? 'PRESS SPACE' : 'CLICK OR TAP TO PLAY', 76, '#ffd23f');
    } else if (state === 'over') {
      text('GAME OVER', 44, '#ff4d6d');
      text(`YOU REACHED: ${e.name.toUpperCase()}`, 60, '#ffffff', 6);
      text(`SCORE ${score()}`, 74, '#ffffff', 6);
      if (blink) text('SPACE / TAP TO RETRY', 92, '#ffd23f', 6);
    } else if (banner > 0) {
      ctx.globalAlpha = Math.min(1, banner * 2);
      text(e.name.toUpperCase(), 34, '#ffffff');
      text(e.when.toUpperCase(), 48, '#ffd23f', 6);
      if (e.note) text(e.note.toUpperCase(), 60, '#ffffff', 6);
      ctx.globalAlpha = 1;
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(${flashColour}, ${Math.min(1, flash) * 0.45})`;
      ctx.fillRect(-4, -4, W + 8, H + 8);
    }
    ctx.restore();
  }

  const stopLoop = visibleLoop(canvas, (dt) => {
    update(dt);
    draw();
  });

  const isJumpKey = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
  canvas.addEventListener('keydown', (e) => {
    if (!isJumpKey(e)) return;
    e.preventDefault();
    if (!e.repeat) press();
  });
  canvas.addEventListener('keyup', (e) => isJumpKey(e) && release());
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    press();
  });
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  resetWeather();
  showEra();

  if (import.meta.env.DEV) {
    // Dev-only shortcut for checking an era without playing through: canvas.__warp(index).
    Object.assign(canvas, {
      __warp: (i: number) => {
        if (state !== 'running') {
          reset();
          state = 'running';
        }
        dist = ERAS[i].start;
        enterEra(i);
      },
    });
  }

  return () => {
    stopLoop();
    stage.replaceChildren();
  };
}
