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

const PALETTE: Record<string, string> = {
  c: '#00e5ff', m: '#ff2bd6', w: '#ffffff', k: '#0a0820',
  r: '#ff4d6d', g: '#39ff14', y: '#ffd23f', p: '#7a5cff',
};

const BODY = [
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
const LEGS = {
  a: ['...pp..pp...', '..pp....pp..', '.pp......pp.', '............'],
  b: ['....pppp....', '....p..p....', '....p..p....', '...pp..pp...'],
  air: ['..pppppppp..', '..p......p..', '............', '............'],
};
const BUG = [
  '.r......r.',
  '..r....r..',
  '...rrrr...',
  '.rrwrrwrr.',
  'rrrkrrkrrr',
  '.rrrrrrrr.',
  'r.r.rr.r.r',
  'r.r....r.r',
];
const DRONE = [
  '..pppppppppp..',
  '.pmmmmmmmmmmp.',
  'ppmwmmmmmmwmpp',
  '.pmmmmmmmmmmp.',
  '..p..y..y..p..',
  '..............',
];
const COMMIT = [
  '...g...',
  '..ggg..',
  '.ggwgg.',
  'ggwwwgg',
  '.ggwgg.',
  '..ggg..',
  '...g...',
];

function sprite(rows: string[]): HTMLCanvasElement {
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

type Kind = 'bug' | 'drone' | 'commit';
interface Thing {
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  taken: boolean;
}

export interface RunnerHooks {
  onStart(): void;
  onScore(score: number): void;
}

export function mountRunner(stage: HTMLElement, hooks: RunnerHooks): () => void {
  stage.innerHTML = `
    <div class="runner">
      <canvas width="${W}" height="${H}" tabindex="0" aria-label="Mini-game. Press Space or tap to jump over bugs and collect commits."></canvas>
      <div class="runner-bar">
        <span>Score <b data-score>0</b></span>
        <span>Best <b data-best>0</b></span>
        <span class="runner-keys">Space / Tap = Jump</span>
      </div>
    </div>`;

  const canvas = stage.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const scoreEl = stage.querySelector<HTMLElement>('[data-score]')!;
  const bestEl = stage.querySelector<HTMLElement>('[data-best]')!;

  const sprites = {
    run: [sprite([...BODY, ...LEGS.a]), sprite([...BODY, ...LEGS.b])],
    air: sprite([...BODY, ...LEGS.air]),
    bug: sprite(BUG),
    drone: sprite(DRONE),
    commit: sprite(COMMIT),
  };
  const stars = Array.from({ length: 40 }, () => ({
    x: Math.random() * W,
    y: Math.random() * (GROUND - 40),
    s: Math.random() < 0.2 ? 2 : 1,
  }));
  const SKY_W = W + 80;
  const skyline: { x: number; w: number; h: number }[] = [];
  for (let x = 0; x < SKY_W; ) {
    const bw = 14 + Math.floor(Math.random() * 22);
    skyline.push({ x, w: bw, h: 16 + Math.floor(Math.random() * 46) });
    x += bw + 2;
  }

  let state: 'ready' | 'running' | 'over' = 'ready';
  let y = GROUND - PLAYER_H, vy = 0, grounded = true;
  let speed = 150, dist = 0, commits = 0, nextSpawn = 120, t = 0, flash = 0, overAt = 0;
  let things: Thing[] = [];
  let best = store.get<number>('arcade:best', 0);
  let reported = false;
  bestEl.textContent = String(best);

  const score = () => Math.floor(dist / 8) + commits * 50;

  function blip(freq: number, dur: number, type: OscillatorType = 'square', slideTo?: number) {
    const g = audioIfReady();
    if (!g) return;
    const { ctx: ac, master } = g;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.05, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp).connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function reset() {
    y = GROUND - PLAYER_H;
    vy = 0;
    grounded = true;
    speed = 150;
    dist = 0;
    commits = 0;
    nextSpawn = 120;
    things = [];
    scoreEl.textContent = '0';
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
      state = 'running';
      reset();
      hooks.onStart();
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

  function spawn() {
    if (score() > 60 && Math.random() < 0.3) {
      things.push({ kind: 'drone', x: W + 10, y: GROUND - 32, w: 14, h: 6, taken: false });
    } else {
      things.push({ kind: 'bug', x: W + 10, y: GROUND - 8, w: 10, h: 8, taken: false });
      if (Math.random() < 0.4) things.push({ kind: 'commit', x: W + 11, y: GROUND - 44, w: 7, h: 7, taken: false });
    }
    nextSpawn = (110 + Math.random() * 130) * Math.sqrt(speed / 150);
  }

  function gameOver() {
    state = 'over';
    overAt = performance.now();
    flash = 1;
    const s = score();
    if (s > best) {
      best = s;
      store.set('arcade:best', best);
      bestEl.textContent = String(best);
    }
    blip(300, 0.4, 'sawtooth', 60);
  }

  function update(dt: number) {
    t += dt;
    flash = Math.max(0, flash - dt * 3);
    if (state !== 'running') return;

    speed = Math.min(340, speed + 5 * dt);
    const dx = speed * dt;
    dist += dx;
    nextSpawn -= dx;
    if (nextSpawn <= 0) spawn();

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
      if (right < th.x + 1 || left > th.x + th.w - 1 || bottom < th.y + 1 || top > th.y + th.h - 1) continue;
      if (th.kind === 'commit') {
        th.taken = true;
        commits++;
        blip(988, 0.08);
        blip(1319, 0.12);
      } else {
        gameOver();
        return;
      }
    }
    things = things.filter((th) => !th.taken && th.x + th.w > -4);

    const s = score();
    scoreEl.textContent = String(s);
    if (s >= 500 && !reported) {
      reported = true;
      hooks.onScore(s);
    }
  }

  function text(s: string, ty: number, colour: string) {
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0820';
    ctx.fillText(s, W / 2 + 1, ty + 1);
    ctx.fillStyle = colour;
    ctx.fillText(s, W / 2, ty);
  }

  function draw() {
    ctx.fillStyle = '#07051a';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#5b4fa8';
    for (const s of stars) {
      const x = (((s.x - dist * 0.05) % W) + W) % W;
      ctx.fillRect(Math.floor(x), s.y, s.s, s.s);
    }
    ctx.fillStyle = '#1a1446';
    for (const b of skyline) {
      const x = (((b.x - dist * 0.25) % SKY_W) + SKY_W) % SKY_W - 40;
      ctx.fillRect(Math.floor(x), GROUND - b.h, b.w, b.h);
    }

    ctx.fillStyle = '#ff2bd6';
    ctx.fillRect(0, GROUND, W, 1);
    ctx.fillStyle = '#2a1f6b';
    for (let x = -(dist % 16); x < W; x += 16) ctx.fillRect(Math.floor(x), GROUND + 6, 8, 1);
    for (let x = -((dist * 1.5) % 24); x < W; x += 24) ctx.fillRect(Math.floor(x), GROUND + 15, 14, 1);

    for (const th of things) {
      const bob = th.kind === 'commit' ? Math.round(Math.sin(t * 6 + th.x) * 1.5) : 0;
      ctx.drawImage(sprites[th.kind], Math.floor(th.x), Math.floor(th.y) + bob);
    }

    const frame = !grounded ? sprites.air : sprites.run[state === 'running' ? Math.floor(dist / 10) % 2 : Math.floor(t * 3) % 2];
    ctx.drawImage(frame, PLAYER_X, Math.floor(y));

    const blink = Math.floor(t * 2) % 2 === 0;
    if (state === 'ready') {
      text('BUG RUNNER', 46, '#00e5ff');
      if (blink) text(document.activeElement === canvas ? 'PRESS SPACE' : 'CLICK OR TAP TO PLAY', 66, '#ffffff');
    } else if (state === 'over') {
      text('GAME OVER', 50, '#ff4d6d');
      text(`SCORE ${score()}`, 66, '#ffffff');
      if (blink) text('SPACE / TAP TO RETRY', 84, '#ffd23f');
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 77, 109, ${flash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
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

  return () => {
    stopLoop();
    stage.replaceChildren();
  };
}
