import { prefersReducedMotion, visibleLoop } from '../lib/dom';

type Pt = [number, number];

interface Body {
  id: string;
  label: string;
  cd: number;
  /** Downforce coefficient; negative means the body generates lift. */
  cl: number;
  /** Frontal (or planform, for the wing) reference area in m². */
  area: number;
  /** Outline in body-length units: x 0→1 nose to tail, y down, centred on 0. */
  shape: Pt[];
  wheels: Pt[];
  wheelR: number;
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
}

const CELL = 8;
const RAKE_GAP = 13;
const BG = '#0a0b0e';
const RHO = 1.225;
// Slow (blue) → fast (red), like a CFD velocity plot.
const SPEED_COLOURS = ['#3a6df0', '#2f9bff', '#22c7e0', '#34e0a1', '#b8e34a', '#ffd000', '#ff8a1f', '#ff3b30'];

/** Converts an outline drawn in a 0→1 box into body-length units with the given height/length ratio. */
const fromBox = (aspect: number, pts: Pt[]): Pt[] => pts.map(([x, y]) => [x, (y - 0.5) * aspect]);

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

const BODIES: Body[] = [
  {
    id: 'coupe',
    label: 'GT coupé',
    cd: 0.31,
    cl: 0.15,
    area: 2.0,
    grounded: true,
    scale: 0.56,
    wheelR: 0.075,
    wheels: [[0.19, 0.087], [0.81, 0.087]],
    shape: fromBox(0.29, [
      [0, 0.8], [0.015, 0.62], [0.08, 0.54], [0.27, 0.46], [0.4, 0.18], [0.5, 0.06], [0.63, 0.06],
      [0.76, 0.24], [0.93, 0.33], [1, 0.36], [0.995, 0.7], [0.97, 0.84], [0.03, 0.86],
    ]),
  },
  {
    id: 'wing',
    label: 'Rear wing',
    cd: 0.12,
    cl: 1.4,
    area: 1.0,
    grounded: false,
    scale: 0.46,
    wheelR: 0,
    wheels: [],
    shape: invertedWing(),
  },
  {
    id: 'van',
    label: 'Box van',
    cd: 0.58,
    cl: -0.05,
    area: 7.2,
    grounded: true,
    scale: 0.5,
    wheelR: 0.07,
    wheels: [[0.17, 0.19], [0.83, 0.19]],
    shape: fromBox(0.48, [[0, 0.9], [0, 0.14], [0.025, 0.03], [0.07, 0], [1, 0], [1, 0.9]]),
  },
];

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

export function mountWindTunnel(stage: HTMLElement): () => void {
  stage.innerHTML = `
    <div class="tunnel">
      <div class="tunnel-view">
        <canvas class="tunnel-canvas" aria-label="Animated airflow around the selected body"></canvas>
        <span class="tunnel-tag"><i></i>Wind tunnel · live</span>
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
        <label class="tunnel-speed">
          <span>Air speed</span>
          <input type="range" min="40" max="320" step="5" value="160" />
          <output>160 km/h</output>
        </label>
        <button type="button" class="tunnel-mode" aria-pressed="false">Smoke rake</button>
      </div>
    </div>`;

  const canvas = stage.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const speedInput = stage.querySelector<HTMLInputElement>('input[type=range]')!;
  const speedOut = stage.querySelector<HTMLOutputElement>('.tunnel-speed output')!;
  const modeBtn = stage.querySelector<HTMLButtonElement>('.tunnel-mode')!;
  const readout = (key: string) => stage.querySelector<HTMLElement>(`[data-r="${key}"]`)!;

  const reduced = prefersReducedMotion();
  let body = BODIES[0];
  let kmh = 160;
  let smoke = false;
  let w = 0, h = 0, len = 0, groundY = Infinity;
  let poly: Pt[] = [];
  let wheels: [number, number, number][] = [];
  let bb = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let field: Field | null = null;
  let particles: Particle[] = [];
  let wand: Particle[] = [];
  let pointer: Pt | null = null;
  let road = 0, spin = 0, time = 0, warmup = 0;

  function sdf(px: number, py: number) {
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
    let d = Math.sqrt(best);
    let nx = d > 1e-6 ? (px - qx) / d : 0;
    let ny = d > 1e-6 ? (py - qy) / d : -1;
    if (inside) { d = -d; nx = -nx; ny = -ny; }
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
   * Builds an approximate steady flow field: freestream deflected around the body's surface,
   * accelerated where it runs tangentially (over the roof), slowed into a turbulent wake behind it,
   * and turned upward behind a downforce-producing body. Not CFD — but it reads like a smoke tunnel.
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
    const reach = len * 0.09;
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
        // Split the flow above/below the stagnation point instead of letting it stall there.
        if (nx < 0) uy += Math.sign(py - midY || 1) * near * 0.3 * -nx;
        const boost = 1 + 0.5 * near * (1 - Math.abs(nx));
        ux *= boost; uy *= boost;

        let wake = 0;
        if (px > rearX) {
          const dx = px - rearX, spread = halfH * (1 + (dx / len) * 0.6), dy = Math.abs(py - midY);
          if (dy < spread) wake = body.cd * Math.exp(-dx / (len * 0.9)) * (1 - dy / spread);
        }
        const along = Math.max(0, Math.min(1, (px - bb.minX) / len));
        uy -= body.cl * 0.1 * Math.exp(-Math.hypot(px - bb.maxX, py - midY) / (len * 0.5)) * (0.3 + 0.7 * along);

        const slow = 1 - Math.min(0.75, wake * 1.3);
        f.vx[i] = ux * slow;
        f.vy[i] = uy * slow;
        f.wake[i] = wake;
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
    p.s = 1;
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
    const maxY = Math.max(...body.shape.map((p) => p[1]), ...body.wheels.map((p) => p[1] + body.wheelR));
    groundY = body.grounded ? h * 0.8 : Infinity;
    const cy = body.grounded ? groundY - maxY * len : h * 0.5;
    poly = body.shape.map(([x, y]) => [x0 + x * len, cy + y * len]);
    wheels = body.wheels.map(([x, y]) => [x0 + x * len, cy + y * len, body.wheelR * len]);

    const xs = [...poly.map((p) => p[0]), ...wheels.flatMap(([x, , r]) => [x - r, x + r])];
    const ys = [...poly.map((p) => p[1]), ...wheels.flatMap(([, y, r]) => [y - r, y + r])];
    bb = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };

    field = buildField();
    const count = Math.round(Math.min(900, Math.max(260, (w * h) / 420)));
    particles = Array.from({ length: count }, () => {
      const p: Particle = { x: 0, y: 0, px: 0, py: 0, s: 1, seed: 0, life: Infinity };
      spawn(p, true);
      return p;
    });
    wand = [];
    warmup = 0;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
  }

  function advance(p: Particle, f: Field, speed: number, dt: number): boolean {
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
      const t = time * 7 + p.seed;
      vy += Math.sin(t + p.x * 0.045) * wk * 1.4;
      vx += Math.cos(t * 1.3) * wk * 0.5;
    }
    p.s = f.speed[i];
    p.x += vx * speed * dt;
    p.y += vy * speed * dt;
    p.life -= dt;
    return !(p.x > w + 4 || p.y < -4 || p.y > airBottom() || p.life <= 0);
  }

  function step(dt: number) {
    if (!field) return;
    time += dt;
    const speed = (kmh / 160) * w * 0.32;
    road = (road + speed * dt) % 40;
    if (wheels.length) spin += (speed * dt) / wheels[0][2];

    for (const p of particles) if (!advance(p, field, speed, dt)) spawn(p, false);
    if (pointer && wand.length < 260) {
      for (let k = 0; k < 4; k++) {
        wand.push({ x: pointer[0], y: pointer[1] + (Math.random() - 0.5) * 3, px: pointer[0], py: pointer[1], s: 1, seed: Math.random() * 6, life: 2.5 });
      }
    }
    wand = wand.filter((p) => advance(p, field!, speed, dt));
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

    ctx.beginPath();
    poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = '#1a1e25';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ff3b30';
    ctx.stroke();

    for (const [cx, cy, r] of wheels) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0d0f12';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2f343d';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#8a93a3';
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = spin + (k * Math.PI * 2) / 5;
        ctx.moveTo(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18);
        ctx.lineTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
      }
      ctx.stroke();
    }
  }

  function updateReadout() {
    const v = kmh / 3.6;
    const q = 0.5 * RHO * v * v;
    const drag = q * body.cd * body.area;
    const down = q * body.cl * body.area;
    const kw = (drag * v) / 1000;
    readout('cd').textContent = body.cd.toFixed(2);
    readout('drag').innerHTML = `${fmt(drag)}<small>N</small>`;
    readout('down-label').textContent = down < 0 ? 'Lift' : 'Downforce';
    readout('down').innerHTML = `${fmt(Math.abs(down))}<small>N · ${fmt(Math.abs(down) / 9.81)} kg</small>`;
    readout('power').innerHTML = `${fmt(kw)}<small>kW · ${fmt(kw * 1.341)} hp</small>`;
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

  let pending = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(layout);
  });
  ro.observe(canvas);

  layout();
  updateReadout();

  return () => {
    stopLoop();
    ro.disconnect();
    cancelAnimationFrame(pending);
    stage.replaceChildren();
  };
}
