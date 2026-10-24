const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs `frame` on every animation frame, but only while `el` is on screen and the tab is visible.
 * `dt` is in seconds and clamped so a long pause never produces a huge physics step.
 */
export function visibleLoop(el: Element, frame: (dt: number, now: number) => void): () => void {
  let raf = 0;
  let last = 0;
  let inView = false;

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    frame(dt, now);
    raf = requestAnimationFrame(tick);
  };

  const sync = () => {
    const shouldRun = inView && !document.hidden;
    if (shouldRun && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  });
  io.observe(el);
  document.addEventListener('visibilitychange', sync);

  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', sync);
    cancelAnimationFrame(raf);
    raf = 0;
  };
}
