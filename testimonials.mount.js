// Mount the Preact testimonials island on the static index.html page.
// This avoids requiring the whole page to be in Astro.
(async function(){
  const root = document.getElementById('testimonials-carousel-root');
  if (!root) return;
  // Respect Safe Mode / reduced motion in the island component via DOM classes/media queries.
  try {
    const [{ h, render }, TestimonialsIsland] = await Promise.all([
      import('https://esm.sh/preact@10.24.0/compat'),
      import('./dist-testimonials-island.js').catch(()=>import('./src/components/TestimonialsIsland.jsx'))
    ]);
    // If we loaded the source module directly, it exports default
    const Comp = (TestimonialsIsland.default) || TestimonialsIsland;
    render(h(Comp, { auto: true, intervalMs: 5000 }), root);
  } catch (e) {
    // If Preact import fails, keep fallback visible
  }
})();
