// Lightweight animation framework integration (Motion One + Lenis)
// - Respects Safe Mode and prefers-reduced-motion
// - Non-breaking: augments existing effects in script.js, does not remove them

(function () {
  const doc = document;
  const root = doc.documentElement;
  const safeMode = root.classList.contains('safe-mode');
  const prefersReduced = (() => {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  })();

  // Skip entirely if Safe Mode or reduced motion is on
  if (safeMode || prefersReduced) return;

  // Defer until DOM is ready
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      // Dynamic ESM imports via CDN to avoid bundler changes
      const [{ animate, inView, stagger }, Lenis] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/motion@10.16.4/dist/motion.mjs'),
        import('https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.45/dist/lenis.module.min.js')
      ]);

      // Optional smooth scrolling (disable on touch devices if you prefer)
      try {
        const lenis = new Lenis.default({
          duration: 1.1,
          smoothWheel: true,
          smoothTouch: false,
          normalizeWheel: true,
          easing: (t) => 1 - Math.pow(1 - t, 2),
        });
        function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
        requestAnimationFrame(raf);
      } catch {}

      // Enhance reveal-on-scroll with Motion One inView
      const REVEAL_SEL = '.reveal';
      const nodes = Array.from(doc.querySelectorAll(REVEAL_SEL));
      if (nodes.length) {
        // Hint the browser for transforms
        nodes.forEach((el) => { el.style.willChange = 'transform, opacity'; });

        inView(REVEAL_SEL, ({ target, entry }) => {
          // Avoid double-running
          if (target.__m1Animated) return;
          target.__m1Animated = true;

          // Stagger by sibling order
          const siblings = Array.from(target.parentElement?.querySelectorAll(REVEAL_SEL) || []);
          const idx = Math.max(0, siblings.indexOf(target));
          const delay = Math.min(idx * 0.08, 0.5); // seconds

          // If element has bounce class, use a slightly springy easing
          const isBounce = target.classList.contains('bounce');
          const keyframes = {
            opacity: [0, 1],
            transform: ['translateY(14px)', 'translateY(0px)']
          };
          animate(target, keyframes, {
            duration: isBounce ? 0.9 : 0.6,
            delay,
            easing: isBounce ? 'cubic-bezier(.2,.8,.2,1.2)' : 'cubic-bezier(.2,.7,.2,1)'
          }).finished.then(() => {
            try { target.classList.add('revealed'); } catch {}
          });
        }, { margin: '0px 0px -8% 0px', amount: 0.15 });
      }

      // Subtle parallax for decorative blobs (kept very light)
      try {
        const blobs = Array.from(doc.querySelectorAll('.creative-blob'));
        if (blobs.length) {
          let mx = 0.5, my = 0.5;
          window.addEventListener('mousemove', (e) => {
            mx = e.clientX / window.innerWidth;
            my = e.clientY / window.innerHeight;
          }, { passive: true });
          let ticking = false;
          const onScroll = () => {
            if (ticking) return; ticking = true;
            requestAnimationFrame(() => {
              const y = window.scrollY || 0;
              blobs.forEach((b, i) => {
                const depth = (i + 1) * 0.035;
                const px = (mx - 0.5) * 26 * (i + 1);
                const py = (my - 0.5) * 26 * (i + 1);
                b.style.transform = `translate3d(${px.toFixed(1)}px, ${(-y * depth + py).toFixed(1)}px, 0)`;
              });
              ticking = false;
            });
          };
          window.addEventListener('scroll', onScroll, { passive: true });
          onScroll();
        }
      } catch {}
    } catch (e) {
      // Silently ignore if CDN blocked or offline
    }
  });
})();
