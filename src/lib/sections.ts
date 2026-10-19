export interface SectionChange {
  id: string;
  /** Position in the section list; -1 for the hero. */
  index: number;
}

let current: SectionChange = { id: 'top', index: -1 };

export const currentSection = () => current;

/**
 * Reveals `.reveal` elements as they scroll in, and fires `section:change` whenever the
 * section crossing the middle of the viewport changes.
 */
export function observeSections(ids: readonly string[]): () => void {
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        reveal.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  document.querySelectorAll('.reveal:not(.in)').forEach((el) => reveal.observe(el));

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.target.id === current.id) continue;
        current = { id: entry.target.id, index: ids.indexOf(entry.target.id) };
        document.dispatchEvent(new CustomEvent<SectionChange>('section:change', { detail: current }));
      }
    },
    { rootMargin: '-45% 0px -54% 0px' },
  );
  for (const id of ['top', ...ids]) {
    const el = document.getElementById(id);
    if (el) spy.observe(el);
  }

  return () => {
    reveal.disconnect();
    spy.disconnect();
  };
}

export function onSectionChange(cb: (section: SectionChange) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<SectionChange>).detail);
  document.addEventListener('section:change', handler);
  return () => document.removeEventListener('section:change', handler);
}

export function scrollProgress(): number {
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
}
