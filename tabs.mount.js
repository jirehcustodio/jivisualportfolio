// Hydrate Preact TabsIsland on the static page
(async function(){
  const root = document.getElementById('tabs-root');
  if (!root) return;
  try {
    const [{ h, render }, TabsIsland] = await Promise.all([
      import('https://esm.sh/preact@10.24.0/compat'),
      import('./src/components/TabsIsland.jsx')
    ]);
    const Comp = TabsIsland.default || TabsIsland;
    render(h(Comp, {}), root);
  } catch (e) {
    // Leave fallback tabs visible if hydration fails
  }
})();
