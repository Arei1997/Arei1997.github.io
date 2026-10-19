import { currentSection, onSectionChange, type SectionChange } from '../lib/sections';
import { createV8, IDLE_RPM, REDLINE_RPM, type V8 } from './v8';

const C = 60;
const MAX_RPM = 8000;
const CRANK_FIRST_MS = 650;
const CRANK_WARM_MS = 250;
/** How long the engine idles after you let go before it shuts off. */
const IDLE_LINGER_MS = 3500;

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
    marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${major ? 'major' : 'minor'}${rpm >= REDLINE_RPM ? ' hot' : ''}"/>`;
    if (major) {
      const [tx, ty] = polar(a, 32);
      marks += `<text x="${tx}" y="${ty}" class="num">${k / 2}</text>`;
    }
  }
  const [rx1, ry1] = polar(angleFor(REDLINE_RPM), 49);
  const [rx2, ry2] = polar(angleFor(MAX_RPM), 49);
  return `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M${rx1} ${ry1} A49 49 0 0 1 ${rx2} ${ry2}" class="redzone"/>
      ${marks}
      <text x="60" y="45" class="badge">5.0 V8</text>
      <text x="60" y="89" class="gear">N</text>
      <text x="60" y="103" class="unit">×1000 rpm</text>
      <g class="needle"><line x1="60" y1="67" x2="60" y2="17"/><circle cx="60" cy="60" r="5"/></g>
    </svg>`;
}

export function mountTachometer(host: HTMLElement): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'tacho';
  wrap.innerHTML = `
    <button type="button" class="tacho-dial" aria-label="Rev counter for a Mustang 5.0 V8. Press and hold to start and rev the engine.">${dial()}</button>
    <span class="tacho-hint">Hold to rev</span>`;
  host.append(wrap);

  const btn = wrap.querySelector<HTMLButtonElement>('.tacho-dial')!;
  const needle = wrap.querySelector<SVGGElement>('.needle')!;
  const gear = wrap.querySelector<SVGTextElement>('.gear')!;

  let rpm = IDLE_RPM, shown = -1, holding = false;
  let engine: V8 | null = null;
  let running = false, started = false, crankUntil = 0, lastActive = 0;
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

    if (crankUntil) {
      if (now < crankUntil) {
        rpm = 200 + Math.sin(now / 45) * 45;
      } else {
        // Fires up with a flare before settling to idle.
        crankUntil = 0;
        engine?.crank(false);
        rpm = 1900;
      }
    } else {
      const target = holding ? REDLINE_RPM + 50 : IDLE_RPM + Math.min(velocity * 2200, 6800);
      const seconds = dt / 1000;
      if (target > rpm) {
        // Pull follows a torque curve: strongest mid-range, tapering towards the redline (~3.5 s idle → limiter).
        const accel = 1150 + 1350 * Math.sin((Math.PI * Math.min(rpm, REDLINE_RPM)) / REDLINE_RPM);
        rpm = Math.min(target, rpm + accel * seconds);
      } else {
        // Engine braking: stronger at high revs, easing off as it settles to idle.
        rpm = Math.max(target, rpm - (500 + rpm * 0.45) * seconds);
      }
      if (holding && rpm > REDLINE_RPM - 50 && Math.random() < 0.3) rpm -= 400; // rev limiter bounce
    }

    if (Math.abs(rpm - shown) > 4) {
      needle.setAttribute('transform', `rotate(${angleFor(rpm).toFixed(1)} 60 60)`);
      shown = rpm;
    }
    wrap.classList.toggle('redline', rpm > REDLINE_RPM - 100);

    if (engine) {
      if (holding || crankUntil) lastActive = now;
      const audible = now - lastActive < IDLE_LINGER_MS;
      engine.update(rpm, holding && !crankUntil ? 1 : 0, audible);
      if (!audible) running = false;
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
    btn.classList.add('held');
    engine ??= createV8();
    if (!running) {
      running = true;
      crankUntil = performance.now() + (started ? CRANK_WARM_MS : CRANK_FIRST_MS);
      started = true;
      engine.crank(true);
    }
  };
  const release = () => {
    if (!holding) return;
    holding = false;
    btn.classList.remove('held');
    if (rpm > 4000 && !crankUntil) engine?.crackle();
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
