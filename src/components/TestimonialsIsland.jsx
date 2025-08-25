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
  const touch = useRef({ x: 0, y: 0, t: 0, swiping: false });
  const safeMode = typeof document !== 'undefined' && document.documentElement.classList.contains('safe-mode');
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduced = safeMode || prefersReduced;
  const pausedRef = useRef(false);

  useEffect(() => {
    // Hide fallback once mounted
    const fb = document.getElementById('testimonials-fallback');
    if (fb) fb.style.display = 'none';
  }, []);

  useEffect(() => {
    if (!auto) return;
    const tick = () => { if (!pausedRef.current) setI((p) => (p + 1) % ITEMS.length); };
    const t = setInterval(tick, intervalMs);
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
    <div class="card" aria-roledescription="carousel" aria-label="Testimonials"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={(e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), swiping: true };
        pausedRef.current = true; // pause autoplay while touching
      }}
      onTouchMove={(e) => {
        // No-op: we only decide on end; avoid preventDefault to keep scroll working
      }}
      onTouchEnd={(e) => {
        const data = touch.current;
        if (!data.swiping) return;
        const changed = e.changedTouches && e.changedTouches[0];
        if (!changed) return;
        const dx = changed.clientX - data.x;
        const dy = changed.clientY - data.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const dt = Date.now() - data.t;
        const THRESH = 40; // px
        // Horizontal intent: distance > THRESH, and more horizontal than vertical
        if (adx > THRESH && adx > ady * 1.2 && dt < 1000) {
          if (dx < 0) setI((i + 1) % ITEMS.length); // swipe left -> next
          else setI((i - 1 + ITEMS.length) % ITEMS.length); // swipe right -> prev
        }
        touch.current.swiping = false;
        // Resume autoplay shortly after interaction
        setTimeout(() => { pausedRef.current = false; }, 800);
      }}
    >
      <div ref={wrap}>
        <blockquote style="margin:0;font-size:1.05rem;line-height:1.5;">“{ITEMS[i].quote}”<br/><small>{ITEMS[i].who}</small></blockquote>
      </div>
      <div style="display:flex;justify-content:space-between;gap:.6rem;margin-top:.6rem;align-items:center;">
        <div style="display:flex;gap:.4rem;align-items:center;">
          <button class="cta-btn ghost" aria-label="Previous" onClick={() => setI((i - 1 + ITEMS.length) % ITEMS.length)}>‹</button>
          <button class="cta-btn ghost" aria-label="Next" onClick={() => setI((i + 1) % ITEMS.length)}>›</button>
        </div>
      <div role="tablist" aria-label="Testimonials navigation" style="display:flex;gap:.4rem;margin-top:.6rem;">
        {ITEMS.map((_, idx) => (
          <button
            role="tab"
            aria-selected={idx === i}
            aria-controls={`testi-panel-${idx}`}
            aria-label={`Show testimonial ${idx + 1} of ${ITEMS.length}`}
            tabIndex={idx === i ? 0 : -1}
            class={idx === i ? 'dot active' : 'dot'}
            onClick={() => setI(idx)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setI((i + 1) % ITEMS.length);
              if (e.key === 'ArrowLeft') setI((i - 1 + ITEMS.length) % ITEMS.length);
            }}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
