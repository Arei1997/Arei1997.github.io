import { audio } from '../lib/audio';
import { currentSection, onSectionChange, type SectionChange } from '../lib/sections';

const C = 60;
const MAX_RPM = 8000;
const IDLE = 850;

const angleFor = (rpm: number) => -135 + (Math.min(rpm, MAX_RPM) / MAX_RPM) * 270;
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [+(C + r * Math.sin(a)).toFixed(2), +(C - r * Math.cos(a)).toFixed(2)];
};

function dial(): string {
  let marks = '';
  for (let k = 0; k <= 16; k++) {
    const rpm = k * 500, a = angleFor(rpm), major = k % 2 === 0;
    const [x1, y1] = polar(a, major ? 40 : 44);
    const [x2, y2] = polar(a, 49);
    marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${major ? 'major' : 'minor'}${rpm >= 7000 ? ' hot' : ''}"/>`;
    if (major) {
      const [tx, ty] = polar(a, 32);
      marks += `<text x="${tx}" y="${ty}" class="num">${k / 2}</text>`;
    }
  }
  const [rx1, ry1] = polar(angleFor(7000), 49);
  const [rx2, ry2] = polar(angleFor(MAX_RPM), 49);
  return `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M${rx1} ${ry1} A49 49 0 0 1 ${rx2} ${ry2}" class="redzone"/>
      ${marks}
      <text x="60" y="89" class="gear">N</text>
      <text x="60" y="103" class="unit">×1000 rpm</text>
      <g class="needle"><line x1="60" y1="67" x2="60" y2="17"/><circle cx="60" cy="60" r="5"/></g>
    </svg>`;
}

interface Engine {
  update(rpm: number, audible: boolean): void;
  stop(): void;
}

/** A crude V8: sawtooth + sub-octave square at the firing frequency, saturated and low-passed. */
function createEngine(): Engine {
  const { ctx, master } = audio();
  const out = ctx.createGain();
  out.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 3;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 128 - 1) * 4);
  shaper.curve = curve;
  const base = ctx.createOscillator();
  base.type = 'sawtooth';
  const sub = ctx.createOscillator();
  sub.type = 'square';
  const subGain = ctx.createGain();
  subGain.gain.value = 0.5;
  base.connect(shaper);
  sub.connect(subGain).connect(shaper);
  shaper.connect(lp).connect(out).connect(master);
  base.start();
  sub.start();

  return {
    update(rpm, audible) {
      const t = ctx.currentTime;
      // A four-stroke V8 fires 4 times per revolution.
      const firing = rpm / 15;
      base.frequency.setTargetAtTime(firing, t, 0.02);
      sub.frequency.setTargetAtTime(firing / 2, t, 0.02);
      lp.frequency.setTargetAtTime(250 + rpm * 0.3, t, 0.03);
      out.gain.setTargetAtTime(audible ? 0.14 : 0, t, audible ? 0.04 : 0.25);
    },
    stop() {
      const t = ctx.currentTime;
      out.gain.setTargetAtTime(0, t, 0.05);
      base.stop(t + 0.3);
      sub.stop(t + 0.3);
    },
  };
}

export function mountTachometer(hud: HTMLElement): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'tacho';
  wrap.innerHTML = `
    <button type="button" class="tacho-dial" aria-label="Rev counter. Press and hold to rev the engine.">${dial()}</button>
    <span class="tacho-hint">Hold to rev</span>`;
  hud.append(wrap);

  const btn = wrap.querySelector<HTMLButtonElement>('.tacho-dial')!;
  const needle = wrap.querySelector<SVGGElement>('.needle')!;
  const gear = wrap.querySelector<SVGTextElement>('.gear')!;

  let rpm = IDLE, shown = -1, holding = false, audible = false;
  let engine: Engine | null = null;
  let lastY = scrollY, last = performance.now(), raf = 0;

  const showGear = (s: SectionChange) => (gear.textContent = s.index < 0 ? 'N' : String(s.index + 1));
  showGear(currentSection());
  const offSection = onSectionChange((s) => {
    showGear(s);
    wrap.classList.remove('shift');
    void wrap.offsetWidth; // restart the CSS animation
    wrap.classList.add('shift');
  });

  const frame = (now: number) => {
    const dt = Math.min(now - last, 50);
    last = now;
    const velocity = Math.abs(scrollY - lastY) / Math.max(dt, 1);
    lastY = scrollY;

    const target = holding ? 7900 : IDLE + Math.min(velocity * 2200, 6800);
    rpm += (target - rpm) * (target > rpm ? 0.16 : 0.05) * (dt / 16.7);
    if (holding && rpm > 7750 && Math.random() < 0.25) rpm -= 450; // rev limiter bounce

    if (Math.abs(rpm - shown) > 4) {
      needle.setAttribute('transform', `rotate(${angleFor(rpm).toFixed(1)} 60 60)`);
      shown = rpm;
    }
    wrap.classList.toggle('redline', rpm > 7000);
    if (engine) {
      if (holding) audible = true;
      else if (rpm < 1300) audible = false;
      engine.update(rpm, audible);
    }
    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!document.hidden) {
      last = performance.now();
      lastY = scrollY;
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', sync);
  sync();

  const press = () => {
    holding = true;
    engine ??= createEngine();
    btn.classList.add('held');
  };
  const release = () => {
    holding = false;
    btn.classList.remove('held');
  };
  const isRevKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    press();
  });
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('keydown', (e) => {
    if (!isRevKey(e)) return;
    e.preventDefault();
    if (!e.repeat) press();
  });
  btn.addEventListener('keyup', (e) => isRevKey(e) && release());
  btn.addEventListener('blur', release);

  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', sync);
    offSection();
    engine?.stop();
    wrap.remove();
  };
}
