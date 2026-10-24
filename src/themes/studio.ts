import { mountDaw } from '../interactive/daw';
import { audioIfReady } from '../lib/audio';
import { visibleLoop } from '../lib/dom';
import type { MountContext } from './index';

/** Master-bus spectrum meter in the transport bar. */
function mountVisualizer(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  const BARS = 32;
  let bins: Uint8Array<ArrayBuffer> | null = null;

  return visibleLoop(canvas, (_dt, now) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const g = audioIfReady();
    if (g && !bins) bins = new Uint8Array(new ArrayBuffer(g.analyser.frequencyBinCount));
    if (g && bins) g.analyser.getByteFrequencyData(bins);

    const bw = w / BARS;
    for (let i = 0; i < BARS; i++) {
      const idle = 0.06 + 0.04 * Math.sin(now / 700 + i * 0.45);
      // Log-ish spacing so the musically useful low end gets most of the bars.
      const level = bins ? bins[Math.floor((i / BARS) ** 1.7 * bins.length * 0.7)] / 255 : 0;
      const bh = Math.max(idle, level) * h;
      ctx.fillStyle = level > 0.8 ? '#ffb347' : level > idle ? '#8de08a' : 'rgba(141, 224, 138, 0.25)';
      ctx.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 2), bh);
    }
  });
}

export function mount({ stage }: MountContext) {
  let inView = false;
  const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting));
  io.observe(stage);

  const stopDaw = mountDaw(stage, { inView: () => inView });
  const stopViz = mountVisualizer(stage.querySelector<HTMLCanvasElement>('.viz')!);

  return () => {
    io.disconnect();
    stopDaw();
    stopViz();
    stage.replaceChildren();
  };
}
