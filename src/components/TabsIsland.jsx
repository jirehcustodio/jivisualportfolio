import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'coding', label: 'Coding Portfolio' },
  { id: 'creative', label: 'Photography & Videography' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

export default function TabsIsland() {
  // Infer initial tab from DOM or hash
  const initial = (() => {
    const h = (typeof location !== 'undefined' ? location.hash.replace('#','') : '') || 'home';
    const valid = new Set(TABS.map(t => t.id));
    const activeBtn = typeof document !== 'undefined' && document.querySelector('.tabs .tab.active');
    const activeId = activeBtn && activeBtn.id && activeBtn.id.startsWith('tab-') ? activeBtn.id.slice(4) : null;
    return valid.has(h) ? h : (valid.has(activeId) ? activeId : 'home');
  })();
  const [active, setActive] = useState(initial);
  const listRef = useRef(null);

  useEffect(() => {
    // Hide fallback
    const fb = document.getElementById('tabs-fallback');
    if (fb) fb.style.display = 'none';
    // Sync content panels
    function setActiveTabPanel(id) {
      const tabsEl = document.querySelector('.tabs') || fb;
      // Hide all
      Array.from(document.querySelectorAll('.tab-content')).forEach(el => el.style.display = 'none');
      const target = document.getElementById('tab-content-' + id);
      if (target) target.style.display = 'block';
      // Indicator update via existing function if present
      try { window.setActiveTab && window.setActiveTab(id); } catch {}
    }
    setActiveTabPanel(active);
  }, []);

  useEffect(() => {
    // Update content on change
    const target = document.getElementById('tab-content-' + active);
    Array.from(document.querySelectorAll('.tab-content')).forEach(el => el.style.display = 'none');
    if (target) target.style.display = 'block';
    // Update hash for deep-linking
    try { history.replaceState(null, '', '#' + active); } catch {}
  }, [active]);

  function onKeyDown(e, idx) {
    const l = TABS.length;
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(TABS[(idx+1)%l].id); focusIdx(idx+1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(TABS[(idx-1+l)%l].id); focusIdx(idx-1); }
    if (e.key === 'Home') { e.preventDefault(); setActive(TABS[0].id); focusIdx(0); }
    if (e.key === 'End') { e.preventDefault(); setActive(TABS[l-1].id); focusIdx(l-1); }
  }
  function focusIdx(idx){
    const list = listRef.current;
    if (!list) return;
    const btns = list.querySelectorAll('[role="tab"]');
    const i = ((idx % btns.length) + btns.length) % btns.length;
    btns[i]?.focus();
  }

  return (
    <div class="tabs" role="tablist" aria-label="Sections" ref={listRef}>
      {TABS.map((t, idx) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          aria-controls={`tab-content-${t.id}`}
          id={`tab-${t.id}`}
          class={"tab" + (active === t.id ? " active" : "")}
          tabIndex={active === t.id ? 0 : -1}
          onClick={() => setActive(t.id)}
          onKeyDown={(e) => onKeyDown(e, idx)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
