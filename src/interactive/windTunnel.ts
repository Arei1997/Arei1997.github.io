import { prefersReducedMotion, visibleLoop } from '../lib/dom';

type Pt = [number, number];
type Circle = [number, number, number];

interface Body {
  id: string;
  label: string;
  /** Drag coefficient at full-scale Reynolds number (~10⁷). */
  cd: number;
  /** Downforce coefficient; negative means the body generates lift. */
  cl: number;
  /** Reference area in m² (frontal, or planform for the wing). */
  area: number;
  /** Real-world length in metres, used to turn Re into an equivalent fluid viscosity. */
  length: number;
  /** Wetted-to-reference area ratio — how much surface skin friction acts on. */
  wetted: number;
  /** Outlines in body-length units: x 0→1 nose to tail, y down. */
  shapes: Pt[][];
  wheels: Pt[];
  wheelR: number;
  helmet?: Circle;
  grounded: boolean;
  /** Fraction of the canvas width the body occupies. */
  scale: number;
}

interface Field {
  cols: number;
  rows: number;
  vx: Float32Array;
  vy: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  dist: Float32Array;
  wake: Float32Array;
  speed: Float32Array;
  /** 0 = air, 1 = body, 2 = ground. */
  solid: Uint8Array;
}

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  s: number;
  seed: number;
  life: number;
  stuck: number;
}

const CELL = 8;
const RAKE_GAP = 13;
const BG = '#0a0b0e';
const RHO = 1.225;
const RE_REF = 1e7;
// Slow (blue) → fast (red), like a CFD velocity plot.
const SPEED_COLOURS = ['#6f8cff', '#4fb0ff', '#2fd3ea', '#3ee6a8', '#b8e34a', '#ffd000', '#ff8a1f', '#ff3b30'];

/** Converts an outline drawn in a 0→1 box into body-length units with the given height/length ratio. */
const fromBox = (aspect: number, pts: Pt[]): Pt[] => pts.map(([x, y]) => [x, (y - 0.5) * aspect]);
/** Converts (x, height above ground) pairs into y-down coordinates. */
const side = (pts: Pt[]): Pt[] => pts.map(([x, h]) => [x, -h]);

/** NACA 4412 profile, flipped to make downforce and set at 8° angle of attack. */
function invertedWing(): Pt[] {
  const m = 0.04, p = 0.4, t = 0.12, n = 32;
  const upper: Pt[] = [];
  const lower: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((i / n) * Math.PI)) / 2;
    const yc = x < p ? (m / p ** 2) * (2 * p * x - x * x) : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    const dyc = x < p ? ((2 * m) / p ** 2) * (p - x) : ((2 * m) / (1 - p) ** 2) * (p - x);
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    const th = Math.atan(dyc);
    // Screen y points down, so using the maths-space y directly mirrors the aerofoil into a downforce wing.
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  const aoa = (-8 * Math.PI) / 180;
  const rotate = ([x, y]: Pt): Pt => {
    const dx = x - 0.25;
    return [0.25 + dx * Math.cos(aoa) - y * Math.sin(aoa), dx * Math.sin(aoa) + y * Math.cos(aoa)];
  };
  return [...upper.reverse(), ...lower.slice(1)].map(rotate);
}

// Ground-effect era F1 car in side profile, ~5.6 m long. 1 unit = car length.
const F1_SHAPES: Pt[][] = [
  // Chassis: nose, cockpit and halo, airbox, engine cover, diffuser ramp, floor.
  side([
    [0.02, 0.055], [0.1, 0.078], [0.28, 0.105], [0.38, 0.12], [0.43, 0.155], [0.49, 0.158],
    [0.52, 0.172], [0.57, 0.172], [0.64, 0.14], [0.76, 0.1], [0.88, 0.07], [0.91, 0.058],
    [0.94, 0.05], [0.85, 0.014], [0.25, 0.014], [0.24, 0.032], [0.1, 0.045],
  ]),
  // Front wing main plane and flap.
  side([[0, 0.016], [0.05, 0.024], [0.11, 0.022], [0.11, 0.015], [0.05, 0.011], [0, 0.012]]),
  side([[0.075, 0.031], [0.115, 0.05], [0.122, 0.045], [0.085, 0.026]]),
  // Rear wing pillar, main plane and DRS flap.
  side([[0.925, 0.06], [0.932, 0.06], [0.938, 0.146], [0.931, 0.146]]),
  side([[0.875, 0.148], [0.92, 0.158], [0.968, 0.162], [0.968, 0.154], [0.92, 0.146], [0.88, 0.142]]),
  side([[0.948, 0.17], [0.99, 0.19], [0.997, 0.184], [0.958, 0.164]]),
];

const BODIES: Body[] = [
  {
    id: 'f1',
    label: 'F1 car',
    cd: 0.95,
    cl: 3.0,
    area: 1.5,
    length: 5.6,
    wetted: 6,
    grounded: true,
    scale: 0.74,
    wheelR: 0.064,
    wheels: [[0.16, -0.064], [0.8, -0.064]],
    helmet: [0.452, -0.142, 0.019],
    shapes: F1_SHAPES,
  },
  {
    id: 'wing',
    label: 'Rear wing',
    cd: 0.12,
    cl: 1.4,
    area: 1.0,
    length: 0.5,
    wetted: 2.2,
    grounded: false,
    scale: 0.46,
    wheelR: 0,
    wheels: [],
    shapes: [invertedWing()],
  },
  {
    id: 'van',
    label: 'Box van',
    cd: 0.58,
    cl: -0.05,
    area: 7.2,
    length: 5.5,
    wetted: 4,
    grounded: true,
    scale: 0.5,
    wheelR: 0.07,
    wheels: [[0.17, 0.19], [0.83, 0.19]],
    shapes: [fromBox(0.48, [[0, 0.9], [0, 0.14], [0.025, 0.03], [0.07, 0], [1, 0], [1, 0.9]])],
  },
];

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Flat-plate skin-friction coefficient: Blasius (laminar) below transition, Prandtl (turbulent) above. */
const skinFriction = (re: number) => (re < 5e5 ? 1.328 / Math.sqrt(re) : 0.074 / re ** 0.2);
const dragAt = (b: Body, re: number) => b.cd + b.wetted * (skinFriction(re) - skinFriction(RE_REF));
// Lift collapses as viscosity starts to dominate the flow.
const liftAt = (b: Body, re: number) => b.cl * Math.max(0.15, Math.min(1, (Math.log10(re) - 2) / 3.5));

function regime(re: number) {
  if (re < 40) return 'Creeping flow';
  if (re < 2e5) return 'Laminar · vortex shedding';
  if (re < 5e5) return 'Transitional';
  return 'Turbulent';
}

/** Names a real fluid with roughly the kinematic viscosity implied by this Re, speed and size. */
function fluidLike(nu: number) {
  if (nu < 4e-6) return 'water';
  if (nu < 1e-4) return 'air';
  if (nu < 1e-3) return 'motor oil';
  if (nu < 1e-2) return 'honey';
  if (nu < 1) return 'molten glass';
  return 'tar';
}

function formatRe(re: number) {
  const exp = Math.floor(Math.log10(re));
  return `${(re / 10 ** exp).toFixed(1)} × 10<sup>${exp}</sup>`;
}

export function mountWindTunnel(stage: HTMLElement): () => void {
  stage.innerHTML = `
    <div class="tunnel">
      <div class="tunnel-view">
        <canvas class="tunnel-canvas" aria-label="Animated airflow around the selected body"></canvas>
      </div>
      <dl class="tunnel-readout">
        <div><dt>Drag coeff.</dt><dd data-r="cd"></dd></div>
        <div><dt>Drag</dt><dd data-r="drag"></dd></div>
        <div><dt data-r="down-label">Downforce</dt><dd data-r="down"></dd></div>
        <div><dt>Power vs drag</dt><dd data-r="power"></dd></div>
      </dl>
      <div class="tunnel-controls">
        <div class="seg" role="group" aria-label="Test body">
          ${BODIES.map((b, i) => `<button type="button" data-body="${b.id}" aria-pressed="${i === 0}">${b.label}</button>`).join('')}
        </div>
        <button type="button" class="tunnel-mode" aria-pressed="false">Smoke rake</button>
        <label class="tunnel-slider">
          <span>Air speed</span>
          <input type="range" data-speed min="40" max="360" step="5" value="160" />
          <output data-speed-out>160 km/h</output>
        </label>
        <label class="tunnel-slider">
          <span>Reynolds no.</span>
          <input type="range" data-re min="1" max="8" step="0.05" value="7" />
          <output data-re-out></output>
        </label>
        <p class="tunnel-regime" data-regime aria-live="polite"></p>
      </div>
    </div>`;

  const canvas = stage.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const speedInput = stage.querySelector<HTMLInputElement>('[data-speed]')!;
  const speedOut = stage.querySelector<HTMLOutputElement>('[data-speed-out]')!;
  const reInput = stage.querySelector<HTMLInputElement>('[data-re]')!;
  const reOut = stage.querySelector<HTMLOutputElement>('[data-re-out]')!;
  const regimeEl = stage.querySelector<HTMLElement>('[data-regime]')!;
  const modeBtn = stage.querySelector<HTMLButtonElement>('.tunnel-mode')!;
  const readout = (key: string) => stage.querySelector<HTMLElement>(`[data-r="${key}"]`)!;

  const reduced = prefersReducedMotion();
  let body = BODIES[0];
  let kmh = 160;
  let logRe = 7;
  let smoke = false;
  let w = 0, h = 0, len = 0, groundY = Infinity, flowSpeed = 0;
  let polys: Pt[][] = [];
  let wheels: Circle[] = [];
  let helmet: Circle | null = null;
  let bb = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let field: Field | null = null;
  let particles: Particle[] = [];
  let wand: Particle[] = [];
  let pointer: Pt | null = null;
  let road = 0, spin = 0, time = 0, warmup = 0;
  // How much of the wake is a regular vortex street vs chaotic turbulence at the current Re.
  let turbulentMix = 1, sheddingMix = 0;

  const re = () => 10 ** logRe;

  /** Signed distance to the nearest surface (negative inside) plus the outward surface normal. */
  function sdf(px: number, py: number) {
    let d = Infinity, nx = 0, ny = -1;
    for (const poly of polys) {
      let best = Infinity, qx = 0, qy = 0, inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[j];
        const [bx, by] = poly[i];
        if (by > py !== ay > py && px < ((ax - bx) * (py - by)) / (ay - by) + bx) inside = !inside;
        const ex = bx - ax, ey = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
        const cx = ax + ex * t, cy = ay + ey * t;
        const d2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (d2 < best) { best = d2; qx = cx; qy = cy; }
      }
      const dist = Math.sqrt(best);
      const sd = inside ? -dist : dist;
      if (sd < d) {
        d = sd;
        const sign = inside ? -1 : 1;
        nx = dist > 1e-6 ? ((px - qx) / dist) * sign : 0;
        ny = dist > 1e-6 ? ((py - qy) / dist) * sign : -1;
      }
    }
    for (const [cx, cy, r] of wheels) {
      const dc = Math.hypot(px - cx, py - cy);
      if (dc - r < d) {
        d = dc - r;
        nx = dc > 1e-6 ? (px - cx) / dc : 0;
        ny = dc > 1e-6 ? (py - cy) / dc : -1;
      }
    }
    return { d, nx, ny };
  }

  /**
   * Builds an approximate steady flow field: freestream deflected around the body, accelerated where
   * it runs tangentially, slowed by a boundary layer whose thickness scales with 1/√Re, dragged into a
   * wake behind the body and turned upward behind a downforce-producing body. Not CFD — but the trends
   * (and the regime changes as Re varies) read like a real smoke tunnel.
   */
  function buildField(): Field {
    const cols = Math.ceil(w / CELL) + 1, rows = Math.ceil(h / CELL) + 1, n = cols * rows;
    const f: Field = {
      cols, rows,
      vx: new Float32Array(n), vy: new Float32Array(n),
      nx: new Float32Array(n), ny: new Float32Array(n),
      dist: new Float32Array(n), wake: new Float32Array(n),
      speed: new Float32Array(n), solid: new Uint8Array(n),
    };
    const viscous = clamp01((5 - logRe) / 4);
    const reach = len * 0.09 * (1 + 1.8 * viscous);
    const boundaryLayer = len * Math.min(0.25, 3 / Math.sqrt(re()));
    const cd = dragAt(body, re());
    const cl = liftAt(body, re());
    const rearX = bb.maxX - len * 0.04;
    const midY = (bb.minY + bb.maxY) / 2, halfH = (bb.maxY - bb.minY) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c, px = c * CELL, py = r * CELL;
        if (py >= groundY) { f.solid[i] = 2; continue; }
        const { d, nx, ny } = sdf(px, py);
        f.nx[i] = nx; f.ny[i] = ny; f.dist[i] = d;
        if (d <= 0) { f.solid[i] = 1; continue; }

        const near = Math.exp(-d / reach);
        // Freestream is (1, 0), so its component along the surface normal is just nx.
        const k = nx < 0 ? near : near * 0.55;
        let ux = 1 - nx * nx * k;
        let uy = -nx * ny * k;
        // Split the flow around the stagnation point instead of letting it stall there. A car sits on
        // the road, so its air has to go up and over; a free-standing wing splits above and below.
        const split = body.grounded ? -1 : Math.sign(py - midY || 1);
        if (nx < 0) uy += split * near * 0.3 * -nx;
        const boost = 1 + 0.5 * near * (1 - Math.abs(nx)) * (1 - viscous * 0.7);
        ux *= boost; uy *= boost;

        let wake = 0;
        if (px > rearX) {
          const dx = px - rearX, spread = halfH * (1 + (dx / len) * 0.6), dy = Math.abs(py - midY);
          if (dy < spread) wake = Math.min(1.2, cd) * Math.exp(-dx / (len * 0.9)) * (1 - dy / spread);
        }
        // Downforce means air is thrown upward — a "rooster tail" rising off the back of the body.
        const behind = smoothstep(bb.maxX - len * 0.25, bb.maxX, px);
        uy -= Math.min(cl, 2) * 0.08 * behind * Math.exp(-Math.abs(py - bb.minY) / (len * 0.2)) * Math.exp(-Math.max(0, px - bb.maxX) / (len * 0.7));

        // No-slip wall: air right at the surface is slowed by the boundary layer.
        const wall = 0.08 + 0.92 * (1 - Math.exp(-d / boundaryLayer));
        // The road is a wall too: nothing flows down into it.
        if (py > groundY - CELL * 2) uy = Math.min(uy, 0);
        const slow = (1 - Math.min(0.75, wake * 1.3)) * wall;
        f.vx[i] = ux * slow;
        f.vy[i] = uy * slow;
        f.wake[i] = wake * (1 - viscous * 0.8);
        f.speed[i] = Math.hypot(f.vx[i], f.vy[i]);
      }
    }
    return f;
  }

  const airBottom = () => Math.min(h, groundY) - 2;
  const rakeY = () => {
    const lanes = Math.max(1, Math.floor((airBottom() - 8) / RAKE_GAP));
    return 6 + Math.floor(Math.random() * lanes) * RAKE_GAP;
  };

  function spawn(p: Particle, anywhere: boolean) {
    p.x = anywhere ? Math.random() * w : -Math.random() * 30;
    p.y = smoke ? rakeY() : 2 + Math.random() * (airBottom() - 2);
    p.px = p.x; p.py = p.y;
    p.seed = Math.random() * Math.PI * 2;
    p.life = Infinity;
    p.stuck = 0;
    p.s = 1;
  }

  function rebuild() {
    turbulentMix = smoothstep(5, 5.8, logRe);
    sheddingMix = smoothstep(1.6, 2.4, logRe) * (1 - turbulentMix);
    field = buildField();
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    w = rect.width; h = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    len = Math.min(w * body.scale, h * 1.6);
    const x0 = (w - len) * 0.42;
    const allY = [...body.shapes.flat().map((p) => p[1]), ...body.wheels.map((p) => p[1] + body.wheelR)];
    groundY = body.grounded ? h * 0.8 : Infinity;
    const cy = body.grounded ? groundY - Math.max(...allY) * len : h * 0.5;
    const toPx = ([x, y]: Pt): Pt => [x0 + x * len, cy + y * len];
    polys = body.shapes.map((shape) => shape.map(toPx));
    wheels = body.wheels.map((p) => [...toPx(p), body.wheelR * len] as Circle);
    helmet = body.helmet ? ([...toPx([body.helmet[0], body.helmet[1]]), body.helmet[2] * len] as Circle) : null;

    const xs = [...polys.flat().map((p) => p[0]), ...wheels.flatMap(([x, , r]) => [x - r, x + r])];
    const ys = [...polys.flat().map((p) => p[1]), ...wheels.flatMap(([, y, r]) => [y - r, y + r])];
    bb = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };

    rebuild();
    const count = Math.round(Math.min(900, Math.max(260, (w * h) / 420)));
    particles = Array.from({ length: count }, () => {
      const p: Particle = { x: 0, y: 0, px: 0, py: 0, s: 1, seed: 0, life: Infinity, stuck: 0 };
      spawn(p, true);
      return p;
    });
    wand = [];
    warmup = 0;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
  }

  function advance(p: Particle, f: Field, dt: number): boolean {
    p.px = p.x; p.py = p.y;
    const c = Math.min(f.cols - 1, Math.max(0, Math.round(p.x / CELL)));
    const r = Math.min(f.rows - 1, Math.max(0, Math.round(p.y / CELL)));
    const i = r * f.cols + c;
    if (f.solid[i] === 1) {
      // Slid into the body: push back out along the surface normal.
      const push = -f.dist[i] + 2;
      p.x += f.nx[i] * push; p.y += f.ny[i] * push;
      p.px = p.x; p.py = p.y;
      return true;
    }
    let vx = f.vx[i], vy = f.vy[i];
    const wk = f.wake[i];
    if (wk > 0) {
      if (turbulentMix > 0) {
        const t = time * 7 + p.seed;
        vy += Math.sin(t + p.x * 0.045) * wk * 1.4 * turbulentMix;
        vx += Math.cos(t * 1.3) * wk * 0.5 * turbulentMix;
      }
      if (sheddingMix > 0) {
        // Kármán vortex street: a travelling wave shed at Strouhal number ≈ 0.2.
        const omega = (2 * Math.PI * 0.2 * flowSpeed) / Math.max(20, bb.maxY - bb.minY);
        vy += Math.sin(time * omega - (p.x * omega) / (0.85 * flowSpeed)) * wk * 1.6 * sheddingMix;
      }
    }
    p.s = f.speed[i];
    p.x += vx * flowSpeed * dt;
    p.y += vy * flowSpeed * dt;
    p.life -= dt;
    // Particles parked at a stagnation point would otherwise sit there forever, starving the flow.
    p.stuck = p.s < 0.2 ? p.stuck + dt : 0;
    return !(p.x > w + 4 || p.y < -4 || p.y > airBottom() || p.life <= 0 || p.stuck > 1);
  }

  function step(dt: number) {
    if (!field) return;
    time += dt;
    flowSpeed = (kmh / 160) * w * 0.32;
    road = (road + flowSpeed * dt) % 40;
    if (wheels.length) spin += (flowSpeed * dt) / wheels[0][2];

    for (const p of particles) if (!advance(p, field, dt)) spawn(p, false);
    if (pointer && wand.length < 260) {
      for (let k = 0; k < 4; k++) {
        wand.push({ x: pointer[0], y: pointer[1] + (Math.random() - 0.5) * 3, px: pointer[0], py: pointer[1], s: 1, seed: Math.random() * 6, life: 2.5, stuck: 0 });
      }
    }
    wand = wand.filter((p) => advance(p, field!, dt));
  }

  function strokeAll(list: Particle[]) {
    ctx.beginPath();
    for (const p of list) { ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }

  function draw() {
    ctx.fillStyle = 'rgba(10, 11, 14, 0.2)';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.4;

    if (smoke) {
      ctx.strokeStyle = 'rgba(235, 240, 248, 0.7)';
      strokeAll(particles);
    } else {
      const buckets: Particle[][] = SPEED_COLOURS.map(() => []);
      for (const p of particles) {
        const b = Math.max(0, Math.min(SPEED_COLOURS.length - 1, Math.floor(((p.s - 0.35) / 1.15) * SPEED_COLOURS.length)));
        buckets[b].push(p);
      }
      buckets.forEach((list, b) => {
        ctx.strokeStyle = SPEED_COLOURS[b];
        strokeAll(list);
      });
    }
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    strokeAll(wand);

    if (body.grounded) {
      ctx.fillStyle = '#101216';
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.fillStyle = '#2a2f38';
      ctx.fillRect(0, groundY, w, 1);
      ctx.fillStyle = '#3a404b';
      for (let x = -road; x < w; x += 40) ctx.fillRect(x, groundY + 8, 20, 2);
    }

    ctx.fillStyle = '#1a1e25';
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    for (const poly of polys) {
      ctx.beginPath();
      poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (helmet) {
      const [hx, hy, hr] = helmet;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
      ctx.fillStyle = '#0a0b0e';
      ctx.fillRect(hx - hr * 0.95, hy - hr * 0.25, hr * 1.1, hr * 0.45);
    }

    for (const [cx, cy, r] of wheels) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0d0f12';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2f343d';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ff3b30';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#8a93a3';
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = spin + (k * Math.PI * 2) / 5;
        ctx.moveTo(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18);
        ctx.lineTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
      }
      ctx.stroke();
    }
  }

  function updateReadout() {
    const v = kmh / 3.6;
    const q = 0.5 * RHO * v * v;
    const cd = dragAt(body, re());
    const drag = q * cd * body.area;
    const down = q * liftAt(body, re()) * body.area;
    const kw = (drag * v) / 1000;
    readout('cd').textContent = cd.toFixed(2);
    readout('drag').innerHTML = `${fmt(drag)}<small>N</small>`;
    readout('down-label').textContent = down < 0 ? 'Lift' : 'Downforce';
    readout('down').innerHTML = `${fmt(Math.abs(down))}<small>N · ${fmt(Math.abs(down) / 9.81)} kg</small>`;
    readout('power').innerHTML = `${fmt(kw)}<small>kW · ${fmt(kw * 1.341)} hp</small>`;

    reOut.innerHTML = formatRe(re());
    const nu = (v * body.length) / re();
    regimeEl.textContent = `${regime(re())} · at ${kmh} km/h the fluid would be about as viscous as ${fluidLike(nu)}`;
  }

  const stopLoop = visibleLoop(canvas, (dt) => {
    // With reduced motion, only animate briefly to paint a frame, then while the user explores.
    if (reduced && !pointer && warmup > 1.5) return;
    warmup += dt;
    step(dt);
    draw();
  });

  stage.querySelector('.seg')!.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-body]');
    const next = BODIES.find((b) => b.id === btn?.dataset.body);
    if (!btn || !next || next === body) return;
    body = next;
    stage.querySelectorAll('[data-body]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    layout();
    updateReadout();
  });

  speedInput.addEventListener('input', () => {
    kmh = Number(speedInput.value);
    speedOut.textContent = `${kmh} km/h`;
    updateReadout();
  });

  let pendingField = 0;
  reInput.addEventListener('input', () => {
    logRe = Number(reInput.value);
    updateReadout();
    cancelAnimationFrame(pendingField);
    pendingField = requestAnimationFrame(rebuild);
  });

  modeBtn.addEventListener('click', () => {
    smoke = !smoke;
    modeBtn.setAttribute('aria-pressed', String(smoke));
    particles.forEach((p) => spawn(p, true));
  });

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = [e.clientX - r.left, e.clientY - r.top];
  });
  canvas.addEventListener('pointerleave', () => (pointer = null));
  canvas.addEventListener('pointercancel', () => (pointer = null));

  let pendingLayout = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(pendingLayout);
    pendingLayout = requestAnimationFrame(layout);
  });
  ro.observe(canvas);

  layout();
  updateReadout();

  return () => {
    stopLoop();
    ro.disconnect();
    cancelAnimationFrame(pendingLayout);
    cancelAnimationFrame(pendingField);
    stage.replaceChildren();
  };
}
