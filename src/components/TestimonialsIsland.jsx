import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';

const ITEMS = [
  { quote: 'Polished UX and fast turnarounds. A joy to collaborate with.', who: '— Product Lead' },
  { quote: 'Bridges AI ideas with working demos quickly. Great communicator.', who: '— Team Mentor' },
  { quote: 'Attention to detail and accessibility. Users noticed the difference.', who: '— QA Engineer' },
];

export default function TestimonialsIsland({ auto = true, intervalMs = 5000 }) {
  const [i, setI] = useState(0);
  const wrap = useRef(null);
  const safeMode = typeof document !== 'undefined' && document.documentElement.classList.contains('safe-mode');
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduced = safeMode || prefersReduced;

  useEffect(() => {
    // Hide fallback once mounted
    const fb = document.getElementById('testimonials-fallback');
    if (fb) fb.style.display = 'none';
  }, []);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setI((p) => (p + 1) % ITEMS.length), intervalMs);
    return () => clearInterval(t);
  }, [auto, intervalMs]);

  useEffect(() => {
    if (reduced) return; // Respect reduced motion
    const el = wrap.current;
    if (!el) return;
    // Mount transition
    animate(el, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { duration: 0.5, easing: 'ease-out' });
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = wrap.current;
    if (!el) return;
    // Crossfade between items
    animate(el, { opacity: [0, 1], transform: ['translateY(6px)', 'translateY(0px)'] }, { duration: 0.4, easing: 'ease-out' });
  }, [i]);

  return (
    <div class="card" aria-roledescription="carousel" aria-label="Testimonials">
      <div ref={wrap}>
        <blockquote style="margin:0;font-size:1.05rem;line-height:1.5;">“{ITEMS[i].quote}”<br/><small>{ITEMS[i].who}</small></blockquote>
      </div>
      <div role="tablist" aria-label="Testimonials navigation" style="display:flex;gap:.4rem;margin-top:.6rem;">
        {ITEMS.map((_, idx) => (
          <button
            role="tab"
            aria-selected={idx === i}
            aria-controls={`testi-panel-${idx}`}
            tabIndex={idx === i ? 0 : -1}
            class={idx === i ? 'dot active' : 'dot'}
            onClick={() => setI(idx)}
            style="width:10px;height:10px;border-radius:50%;border:none;background:var(--brand-primary,#7f5af0);opacity:0.5;outline:none;"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setI((i + 1) % ITEMS.length);
              if (e.key === 'ArrowLeft') setI((i - 1 + ITEMS.length) % ITEMS.length);
            }}
          />
        ))}
      </div>
    </div>
  );
}
