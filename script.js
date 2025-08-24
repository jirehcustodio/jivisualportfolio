// For touch devices, allow tap to show/hide github tab
function showGithubTab() {
  const el = document.querySelector('.github-tab');
  if (el) el.classList.add('hover');
}
function hideGithubTab() {
  const el = document.querySelector('.github-tab');
  if (el) el.classList.remove('hover');
}
// For touch devices, allow tap to show/hide logout tab (legacy)
function showLogoutTab() {
  const el = document.querySelector('.logout-tab');
  if (el) el.classList.add('hover');
}
function hideLogoutTab() {
  const el = document.querySelector('.logout-tab');
  if (el) el.classList.remove('hover');
}

// Match loader overlay background to the GIF color
function updateLoaderBgFromGif() {
  try {
    const loader = document.getElementById('login-loading');
    if (!loader) return;
    // Respect a locked background set via data-lock-bg
    if (loader.hasAttribute('data-lock-bg')) return;
    const img = loader.querySelector('img.loading-screen');
    if (!img) return;
    const apply = () => {
      try {
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        if (!w || !h) return;
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d', { willReadFrequently: true });
        c.width = w; c.height = h;
        ctx.drawImage(img, 0, 0);
        const sample = (x, y) => ctx.getImageData(Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, y)), 1, 1).data;
        const pts = [ [1,1], [w-2,1], [1,h-2], [w-2,h-2], [Math.floor(w/2), Math.floor(h/2)] ];
        const colors = pts.map(([x,y]) => sample(x,y)).filter(d => d[3] > 0);
        let best = null; const buckets = {};
        const bucketKey = (r,g,b) => `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
        for (const d of colors) {
          const k = bucketKey(d[0], d[1], d[2]);
          buckets[k] = (buckets[k] || 0) + 1;
          if (!best || buckets[k] > buckets[best]) best = k;
        }
        if (best) {
          const [r, g, b] = best.split(',').map(n => parseInt(n, 10) || 0);
          // Slightly translucent to blend nicely
          loader.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
        }
      } catch {}
    };
    if (img.complete) apply(); else img.addEventListener('load', apply, { once: true });
  } catch {}
}
// Apply once DOM is ready
window.addEventListener('DOMContentLoaded', updateLoaderBgFromGif);

// New Intake Flow
async function submitIntake() {
  const first = (document.getElementById('first-name')?.value || '').trim();
  const last = (document.getElementById('last-name')?.value || '').trim();
  const age = parseInt(document.getElementById('age')?.value || '');
  const type = document.getElementById('user-type')?.value || 'student';
  const school = (document.getElementById('school-name')?.value || '').trim();
  const company = (document.getElementById('company-name')?.value || '').trim();
  const error = document.getElementById('login-error');
  const loader = document.getElementById('login-loading');
  if (error) error.textContent = '';
  // Offensive name guard
  const isOffensive = (name) => {
    try {
      const norm = (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/[0o]/g, 'o')
        .replace(/[1l|!]/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/8/g, 'b')
        .replace(/9/g, 'g');
      const badRoots = [
        // existing
        'ZnVjaw==','c2hpdA==','Y3VudA==','bW90aGVyZnVja2Vy',
        // added
        'bmlnZ2E=','cHV0YQ==','cG90YQ==','bmVncm8=','bmVncmE=','bmlnZ2Vy','c2V4','YW5hbA==','Ymxvd2pvYg==','bWlzc2lvbmFyeQ==','ZG9nc3R5bGU='
      ]; // base64 to avoid plain text
      const bad = badRoots.map(b => atob(b));
      return bad.some(w => w && norm.includes(w));
    } catch { return false; }
  };
  if (!first || !last || !age || age < 1) {
    if (error) error.textContent = 'Please fill first name, surname, and a valid age.';
    return;
  }
  if (isOffensive(first) || isOffensive(last)) {
    if (error) error.textContent = 'Please use a real name. Offensive words are not allowed.';
    return;
  }
  if (type === 'student' && !school) {
    if (error) error.textContent = 'Please enter your school name.';
    return;
  }
  if (type === 'employee' && !company) {
    if (error) error.textContent = 'Please enter your company name.';
    return;
  }
  if (loader) loader.style.display = 'flex';
  const payload = { first, last, age, type, school: type==='student'?school:'', company: type==='employee'?company:'' };
  // Resolve resume backend bases: prefer same-origin /api when on HTTPS/Netlify; fallback to meta override and localhost in dev
  function getResumeApiBases() {
    try {
      const meta = document.querySelector('meta[name="resume-api"]')?.content?.trim();
      const bases = [];
      if (meta) bases.push(meta.replace(/\/$/, ''));
      const origin = (window.location && window.location.origin) ? window.location.origin : '';
      // Prefer same-origin function path in production
      if (origin && /^https?:/i.test(origin)) {
        // Map to functions mount
        bases.push(origin.replace(/\/$/, '') + '/.netlify/functions');
        bases.push(origin.replace(/\/$/, '') + '/api');
        bases.push(origin.replace(/\/$/, ''));
      }
      // local fallbacks
      bases.push('http://localhost:3001', 'http://localhost:3002');
      return Array.from(new Set(bases));
    } catch { return ['http://localhost:3001', 'http://localhost:3002']; }
  }
  // Check server for existing profile (cross-device)
  async function checkExists(f, l) {
    const tryOne = async (base) => {
      try {
        const clean = base.replace(/\/$/, '');
        const u = `${clean}/profiles/exists?first=${encodeURIComponent(f)}&last=${encodeURIComponent(l)}`;
        const r = await fetch(u, { method: 'GET' });
        if (!r.ok) return null; return await r.json();
      } catch { return null; }
    };
    for (const base of getResumeApiBases()) {
      const res = await tryOne(base);
      if (res) return res;
    }
    return { exists: false };
  }
  // Try to send to backend CSV endpoint across bases. Consider non-2xx as failure.
  const post = async () => {
    for (const base of getResumeApiBases()) {
      const clean = base.replace(/\/$/, '');
      const url = `${clean}/intake`;
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
        if (res.ok) return true;
      } catch (_) {}
    }
    return false;
  };
  const existsRes = await checkExists(first, last);
  const returningByServer = !!(existsRes && existsRes.exists);
  let saved = await post();
  // If not saved, enqueue locally for later sync
  if (!saved) {
    enqueueIntake(payload);
    // Ask SW to enqueue + register background sync
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'ENQUEUE_INTAKE', payload });
      }
    } catch {}
  }
  // Mark this tab's session as logged in (per-session); clear legacy flag if present
  try {
    sessionStorage.setItem('portfolioLoggedIn', 'true');
    localStorage.removeItem('portfolioLoggedIn');
  } catch {}
  // Persist profile name and mark returning/new status
  try {
    const fullName = `${first} ${last}`.trim().replace(/\s+/g, ' ');
    const key = fullName.toLowerCase();
    let profiles = [];
    try { profiles = JSON.parse(localStorage.getItem('profiles:names') || '[]'); } catch {}
    const known = new Set((profiles || []).map(n => String(n).toLowerCase()));
    const returning = returningByServer || known.has(key);
    if (!returning) {
      profiles.push(fullName);
      localStorage.setItem('profiles:names', JSON.stringify(profiles));
    }
  localStorage.setItem('profile:currentName', fullName);
    sessionStorage.setItem('profile:returning', returning ? '1' : '0');
  // Notify listeners (pet, achievements, etc.) that the active profile changed
  try { window.dispatchEvent(new CustomEvent('profile:changed', { detail: { name: fullName, key }, bubbles: false })); } catch {}
  } catch {}
  showIntakeSummary({ ...payload, __saved: saved });
  try { sessionStorage.setItem('login:sent', '1'); } catch {}
  // Increment entries counter for this profile on the server
  try { if (payload.first && payload.last) upsertProfile({ first: payload.first, last: payload.last, incEntries: true, incLogin: false }); } catch {}
  const loginBox = document.getElementById('login-box');
  if (loginBox) loginBox.style.display = 'none';
  if (!sessionStorage.getItem('splashSeen')) {
    sessionStorage.setItem('splashSeen', 'true');
    // Hold the loading screen until the GIF is ready and for the configured duration, then fade it out before showing the splash
    const fadeMs = (() => { try { return parseInt(loader?.dataset.fadeMs || '400', 10) || 400; } catch { return 400; } })();
    const holdMs = (() => { try { return parseInt(loader?.dataset.duration || '2000', 10) || 2000; } catch { return 2000; } })();
    // ensure image loaded (won't block if already cached)
    try {
      const img = loader?.querySelector('img');
      if (img && !img.complete) await new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
    } catch {}
    await new Promise(res => setTimeout(res, holdMs));
    // Kick off splash now so it's ready under the loader
    const splashPromise = showSplash();
    if (loader) {
      loader.classList.add('fade-out');
      await new Promise(res => setTimeout(res, fadeMs + 20));
      loader.style.display = 'none';
      loader.classList.remove('fade-out');
    }
    splashPromise.then(() => { revealPortfolio(); });
  } else {
    if (loader) loader.style.display = 'none';
    revealPortfolio();
  }
}

// Toggle conditional fields based on user type
window.addEventListener('DOMContentLoaded', () => {
  const typeSel = document.getElementById('user-type');
  const school = document.getElementById('school-name');
  const company = document.getElementById('company-name');
  function update() {
    const v = typeSel?.value || 'student';
    const isStudent = v === 'student';
    const isEmployee = v === 'employee';
    if (school) {
      school.classList.toggle('show', !!isStudent);
      school.setAttribute('aria-hidden', String(!isStudent));
      if ('required' in school) school.required = !!isStudent;
    }
    if (company) {
      company.classList.toggle('show', !!isEmployee);
      company.setAttribute('aria-hidden', String(!isEmployee));
      if ('required' in company) company.required = !!isEmployee;
    }
  // Clear prior error and focus the relevant field for convenience
  const err = document.getElementById('login-error');
  if (err) err.textContent = '';
  if (isStudent && school) school.focus();
  if (isEmployee && company) company.focus();
  }
  if (typeSel) { typeSel.addEventListener('change', update); update(); }
});

function showIntakeSummary({ first, last }) {
  // Top-left toast: greet for 5s, then show loading for 2s, then hide
  try {
    const existing = document.getElementById('welcome-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'welcome-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = `Welcome, ${first} ${last}!`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    // After 5 seconds, switch to loading text + pixel spinner for 2 seconds, then hide
    setTimeout(() => {
      try {
        toast.innerHTML = `Now loading… <span class="spinner-pixel" aria-hidden="true"></span>`;
      } catch {}
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { try { toast.remove(); } catch {} }, 280);
      }, 2000);
    }, 5000);
  } catch {}
}

// ---- Offline intake queue ----
function readIntakeQueue() {
  try {
    const raw = localStorage.getItem('intakeQueue');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeIntakeQueue(arr) {
  try { localStorage.setItem('intakeQueue', JSON.stringify(arr)); } catch {}
}
function enqueueIntake(payload) {
  const q = readIntakeQueue();
  q.push({ ...payload, _ts: Date.now() });
  writeIntakeQueue(q);
}
async function flushIntakeQueue() {
  const q = readIntakeQueue();
  if (q.length === 0) return true;
  const remained = [];
  for (const item of q) {
    const ok1 = await tryPostIntake(item, 'http://localhost:3001/intake');
    const ok = ok1 ? true : await tryPostIntake(item, 'http://localhost:3002/intake');
    if (!ok) remained.push(item);
  }
  writeIntakeQueue(remained);
  return remained.length === 0;
}
async function tryPostIntake(payload, url) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return res.ok;
  } catch { return false; }
}
// Auto flush when back online
window.addEventListener('online', () => { flushIntakeQueue(); });

// On load: try to flush any queued intakes
window.addEventListener('DOMContentLoaded', () => { setTimeout(() => { flushIntakeQueue(); }, 0); });

// ---- Lightweight server event logger (for login events etc.) ----
function getApiBasesForNetlify() {
  try {
    const meta = document.querySelector('meta[name="resume-api"]')?.content?.trim();
    const bases = [];
    if (meta) bases.push(meta.replace(/\/$/, ''));
    const origin = (window.location && window.location.origin) ? window.location.origin : '';
    if (origin && /^https?:/i.test(origin)) {
      bases.push(origin.replace(/\/$/, '') + '/.netlify/functions');
      bases.push(origin.replace(/\/$/, '') + '/api');
      bases.push(origin.replace(/\/$/, ''));
    }
    bases.push('http://localhost:3001', 'http://localhost:3002');
    return Array.from(new Set(bases));
  } catch { return ['http://localhost:3001', 'http://localhost:3002']; }
}
async function postIntakeEventOncePerSession(eventPayload) {
  try {
    if (sessionStorage.getItem('login:sent') === '1') return false;
  } catch {}
  const payload = { ...eventPayload, _event: eventPayload?.type || 'event' };
  for (const base of getApiBasesForNetlify()) {
    const clean = base.replace(/\/$/, '');
    const url = `${clean}/intake`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
      if (res.ok) {
        try { sessionStorage.setItem('login:sent', '1'); } catch {}
        return true;
      }
    } catch {}
  }
  return false;
}

async function upsertProfile({ first, last, incLogin = false, incEntries = false, data = null }) {
  const body = { first, last, incLogin, incEntries };
  if (data && typeof data === 'object') body.data = data;
  for (const base of getApiBasesForNetlify()) {
    const clean = base.replace(/\/$/, '');
    const url = `${clean}/profiles/upsert`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

// Real logout: clear session state and return to login screen
// Default delay for logout overlay (can be overridden via #logout-overlay[data-delay])
const DEFAULT_LOGOUT_DELAY = 1500;
function getLogoutDelay() {
  let d = DEFAULT_LOGOUT_DELAY;
  const overlay = document.getElementById('logout-overlay');
  if (overlay && overlay.dataset && overlay.dataset.delay) {
    const n = parseInt(overlay.dataset.delay, 10);
    if (!Number.isNaN(n) && n >= 0) d = n;
  }
  // Respect reduced motion preference with a much shorter delay
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d = Math.min(d, 300);
    }
  } catch {}
  return d;
}

function logout() {
  // Show logout overlay immediately
  const overlay = document.getElementById('logout-overlay');
  if (overlay) { overlay.style.display = 'grid'; overlay.removeAttribute('aria-hidden'); }
  // Immediately clear auth/session flags so a quick reload won't restore the session
  try { sessionStorage.removeItem('portfolioLoggedIn'); } catch {}
  try { localStorage.removeItem('portfolioLoggedIn'); } catch {}
  try { sessionStorage.removeItem('splashSeen'); } catch {}
  // Give the GIF time to show before clearing UI (adjust delay as desired)
  const delay = getLogoutDelay();
  setTimeout(() => {
    // Ensure any loading overlay is hidden
    const loader = document.getElementById('login-loading');
    if (loader) loader.style.display = 'none';
    // Hide portfolio, show login and header logo
    const portfolio = document.getElementById('portfolio-box');
    if (portfolio) portfolio.style.display = 'none';
    const loginBox = document.getElementById('login-box');
    if (loginBox) loginBox.style.display = 'block';
    const headerLogo = document.getElementById('header-logo');
    if (headerLogo) headerLogo.style.display = 'block';
    const sidebar = document.getElementById('sidebar-left');
    if (sidebar) sidebar.style.display = 'none';
  const sidebarR = document.getElementById('sidebar-right');
  if (sidebarR) sidebarR.style.display = 'none';
    const logoutTabBtn = document.querySelector('.logout-tab-btn');
    if (logoutTabBtn) { logoutTabBtn.classList.remove('show'); logoutTabBtn.classList.add('hide'); }
    // Reset intake form fields and remove any intake summary card
    resetIntakeForm();
    // Reset location hash to avoid auto switching tabs
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    // Hide overlay after transition to login
    if (overlay) { overlay.style.display = 'none'; overlay.setAttribute('aria-hidden', 'true'); }
  }, delay);
}

// Clear intake form inputs and any previous inline summary on logout
function resetIntakeForm() {
  try {
    const first = document.getElementById('first-name');
    const last = document.getElementById('last-name');
    const age = document.getElementById('age');
    const type = document.getElementById('user-type');
    const school = document.getElementById('school-name');
    const company = document.getElementById('company-name');
    const error = document.getElementById('login-error');
    if (first) first.value = '';
    if (last) last.value = '';
    if (age) age.value = '';
    if (type) {
      type.value = 'student';
      // Trigger change to re-toggle conditional fields if a listener is attached
      try { type.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    }
  if (school) { school.value = ''; }
  if (company) { company.value = ''; }
    if (error) error.textContent = '';
    // Remove any welcome toast if present
    const t = document.getElementById('welcome-toast');
    if (t) { t.remove(); }
    else {
      // no-op: legacy cleanup removed
    }
    // Focus first field for convenience
    if (first) first.focus();
  } catch {}
}

// Initial session/bootstrap on load (auto reveal if already logged in)
(function bootstrap() {
  // Allow #intro to replay the splash once
  if ((location.hash || '') === '#intro') {
    try { sessionStorage.removeItem('splashSeen'); } catch {}
  }

  // Migrate legacy persistent flag to session for current visit only
  try {
    if (localStorage.getItem('portfolioLoggedIn') === 'true' && !sessionStorage.getItem('portfolioLoggedIn')) {
      sessionStorage.setItem('portfolioLoggedIn', 'true');
      localStorage.removeItem('portfolioLoggedIn');
    }
  } catch {}

  if (sessionStorage.getItem('portfolioLoggedIn') === 'true') {
    const loginBox = document.getElementById('login-box');
    if (loginBox) loginBox.style.display = 'none';
    const after = () => revealPortfolio();
    if (!sessionStorage.getItem('splashSeen')) {
      sessionStorage.setItem('splashSeen', 'true');
      showSplash(900).then(after);
    } else {
      after();
    }
    // Fire a lightweight login event once per session for server-side visibility
    try {
      if (sessionStorage.getItem('login:sent') !== '1') {
        const fullName = (localStorage.getItem('profile:currentName') || '').trim();
        if (fullName) {
          const [first, ...rest] = fullName.split(/\s+/);
          const last = rest.join(' ');
          // Send intake login event and upsert profile
          postIntakeEventOncePerSession({ type: 'login', first, last });
          upsertProfile({ first, last, incLogin: true });
        }
      }
    } catch {}
  } else {
    // Not logged in: show the intake/login first and keep the portfolio hidden
    const sidebar = document.getElementById('sidebar-left');
    if (sidebar) sidebar.style.display = 'none';
    const sidebarR = document.getElementById('sidebar-right');
    if (sidebarR) sidebarR.style.display = 'none';
    const logoutTabBtn = document.querySelector('.logout-tab-btn');
    if (logoutTabBtn) {
      logoutTabBtn.classList.remove('show');
      logoutTabBtn.classList.add('hide');
    }
    const logo = document.getElementById('header-logo');
    if (logo) logo.style.display = 'block';
    const loginBox = document.getElementById('login-box');
    if (loginBox) { loginBox.style.display = 'block'; loginBox.removeAttribute('aria-hidden'); }
    const portfolio = document.getElementById('portfolio-box');
    if (portfolio) portfolio.style.display = 'none';
  // Skip showing the splash while intake/login is visible (but do not mark it as seen),
  // so it can still play once after a successful login.
  // Defensive: ensure any in-flight splash flyer or hero avatar is not visible while intake is showing
    try {
      const fly = window.__flyAvatar && window.__flyAvatar.fly;
      if (fly) { fly.remove(); window.__flyAvatar = null; }
    } catch {}
    try {
      const heroSlot = document.getElementById('hero-avatar-slot');
      if (heroSlot) { heroSlot.style.visibility = 'hidden'; heroSlot.innerHTML = ''; }
    } catch {}
  }

  // Ensure tabs are wired even before reveal (fallback to delegation)
  wireTabs();

  // Announce current profile once on load so namespaced systems can initialize
  try {
    const fullName = (localStorage.getItem('profile:currentName') || '').trim();
    if (fullName) {
      const key = fullName.toLowerCase();
      window.dispatchEvent(new CustomEvent('profile:changed', { detail: { name: fullName, key }, bubbles: false }));
    }
  } catch {}

  // Wire CTA buttons
  const explore = document.getElementById('explore-work');
  if (explore) {
    explore.addEventListener('click', (e) => { e.preventDefault(); setActiveTab('coding'); });
  }
  const ctaAbout = document.getElementById('cta-about');
  if (ctaAbout) {
    ctaAbout.addEventListener('click', (e) => { e.preventDefault(); setActiveTab('about'); });
  }
  // Sticky CTA -> Contact tab
  const globalCTA = document.getElementById('global-contact-cta');
  if (globalCTA && !globalCTA.__wired) {
    globalCTA.__wired = true;
    globalCTA.addEventListener('click', () => setActiveTab('contact'));
  }
  // Postcard removed
  // Wire Download Resume button
  const dlBtn = document.getElementById('download-resume');
  if (dlBtn && !dlBtn.__wired) {
    dlBtn.__wired = true;
    dlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      // Show maintenance notice and block download
      try {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = 'Resume download is under maintenance.';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { try { toast.remove(); } catch {} }, 260); }, 2000);
      } catch {}
      // Visually reflect disabled state and label
      try {
        dlBtn.setAttribute('aria-disabled', 'true');
        dlBtn.setAttribute('title', 'Under maintenance');
        dlBtn.textContent = 'Download Resume (Under Maintenance)';
      } catch {}
    });
  }

  // Wire Manage my data
  const manageBtn = document.getElementById('manage-data-btn');
  if (manageBtn && !manageBtn.__wired) {
    manageBtn.__wired = true;
    manageBtn.addEventListener('click', (e) => { e.preventDefault(); openPrivacyManager(); });
  }

  // Deep link to tabs via hash
  const validTabs = ['home','coding','creative','about','contact'];
  const applyHash = () => {
    const h = (location.hash || '').replace('#','');
    if (validTabs.includes(h)) setActiveTab(h);
  };
  setTimeout(applyHash, 0);
  window.addEventListener('hashchange', applyHash);

  // Wire logout button
  const lg = document.querySelector('.logout-tab-btn');
  if (lg && !lg.__wiredLogout) {
    lg.__wiredLogout = true;
    lg.addEventListener('click', (e) => { e.preventDefault(); logout(); });
  }

  // Theme toggle button
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn && !themeBtn.__wired) {
    themeBtn.__wired = true;
    const savedTheme = localStorage.getItem('theme:mode') || 'pink';
    applyTheme(savedTheme);
    themeBtn.textContent = `Theme: ${savedTheme === 'ambient' ? 'Ambient' : 'Pink'}`;
    themeBtn.addEventListener('click', () => {
      const mode = document.documentElement.classList.contains('theme-ambient') ? 'pink' : 'ambient';
      applyTheme(mode);
      localStorage.setItem('theme:mode', mode);
      themeBtn.textContent = `Theme: ${mode === 'ambient' ? 'Ambient' : 'Pink'}`;
    });
  }
  // Header Safe Mode toggle
  const safeBtn = document.getElementById('safe-toggle');
  if (safeBtn && !safeBtn.__wired) {
    safeBtn.__wired = true;
    const isOn = document.documentElement.classList.contains('safe-mode');
    safeBtn.textContent = `Safe Mode: ${isOn ? 'On' : 'Off'}`;
    safeBtn.addEventListener('click', () => {
      const on = !document.documentElement.classList.contains('safe-mode');
      document.documentElement.classList.toggle('safe-mode', on);
      try { localStorage.setItem('ux:safeMode', on ? 'on' : 'off'); } catch {}
      safeBtn.textContent = `Safe Mode: ${on ? 'On' : 'Off'}`;
    });
  }
  // Safe Mode: user-controlled reduced motion and clarity
  const SAFE_KEY = 'ux:safeMode';
  try {
    const on = localStorage.getItem(SAFE_KEY) === 'on' || new URLSearchParams(location.search).get('safe') === '1';
    document.documentElement.classList.toggle('safe-mode', on);
  } catch {}
  // Add to command palette if present later
})();

// Settings modal + Developer Mode
(function settingsPanel(){
  window.addEventListener('DOMContentLoaded', function(){
    const openBtn = document.getElementById('open-settings');
  const openBtnRight = document.getElementById('open-settings-right');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close');
    const devToggle = document.getElementById('dev-mode-toggle');
    const devLinks = document.getElementById('dev-links');
    const toggleSafe = document.getElementById('toggle-safe');
    const toggleTheme = document.getElementById('toggle-theme');
    const DEV_KEY = 'ux:devMode';

    function syncDevUI(){
      const on = localStorage.getItem(DEV_KEY) === 'on';
      if (devToggle) devToggle.checked = on;
      if (devLinks) devLinks.style.display = on ? 'block' : 'none';
      document.documentElement.classList.toggle('dev-mode', on);
    }
    function open(){
      if (modal) {
        modal.style.display = 'block';
        modal.removeAttribute('aria-hidden');
        // allow CSS transition to run
        requestAnimationFrame(() => modal.classList.add('show'));
      }
    }
    function close(){
      if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden','true');
        // hide after transition
        setTimeout(() => { try { modal.style.display = 'none'; } catch {} }, 180);
      }
    }

  if (openBtn && !openBtn.__wired){ openBtn.__wired = true; openBtn.addEventListener('click', open); }
  if (openBtnRight && !openBtnRight.__wired){ openBtnRight.__wired = true; openBtnRight.addEventListener('click', open); }
    // Delegated fallback: ensure Settings opens even if direct wiring fails
    if (!document.__wiredOpenSettings) {
      document.__wiredOpenSettings = true;
      document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t) return;
        const btn = t.closest && t.closest('#open-settings, #open-settings-right');
        if (btn) { e.preventDefault(); open(); }
      }, true);
    }
    if (closeBtn && !closeBtn.__wired){ closeBtn.__wired = true; closeBtn.addEventListener('click', close); }
    if (modal && !modal.__wired){
      modal.__wired = true;
      modal.addEventListener('click', (e)=>{ if (e.target === modal) close(); });
    }
    if (devToggle && !devToggle.__wired){
      devToggle.__wired = true;
      devToggle.addEventListener('change', ()=>{
        const on = !!devToggle.checked;
        localStorage.setItem(DEV_KEY, on ? 'on' : 'off');
        syncDevUI();
        // If turning Developer Mode ON, prompt for Admin Key and open the Admin Intake Viewer
        if (on) {
          try {
            // Ask for admin key (prefill from saved if present)
            let saved = '';
            try { saved = localStorage.getItem('admin:key') || ''; } catch {}
            const input = window.prompt('Enter your Admin Key to view intake entries:', saved);
            const key = (input ?? '').toString().trim();
            if (!key) {
              // No key entered: keep modal open and show a tiny toast
              try {
                const t = document.createElement('div'); t.className = 'toast'; t.textContent = 'Admin key required.'; document.body.appendChild(t);
                requestAnimationFrame(() => t.classList.add('show'));
                setTimeout(() => { t.classList.remove('show'); setTimeout(() => { try { t.remove(); } catch {} }, 260); }, 1600);
              } catch {}
              return;
            }
            try { localStorage.setItem('admin:key', key); } catch {}
            // Close the settings modal for a cleaner transition
            close();
            // Open admin viewer in a new tab to allow returning easily
            window.open('admin.html', '_blank', 'noopener');
          } catch {}
        }
      });
    }
    if (toggleSafe && !toggleSafe.__wired){
      toggleSafe.__wired = true;
      toggleSafe.addEventListener('click', ()=>{
        const now = !document.documentElement.classList.contains('safe-mode');
        document.documentElement.classList.toggle('safe-mode', now);
        try { localStorage.setItem('ux:safeMode', now ? 'on' : 'off'); } catch {}
      });
    }
    if (toggleTheme && !toggleTheme.__wired){
      toggleTheme.__wired = true;
      toggleTheme.addEventListener('click', ()=>{
        const mode = document.documentElement.classList.contains('theme-ambient') ? 'pink' : 'ambient';
        if (typeof applyTheme === 'function') applyTheme(mode);
        localStorage.setItem('theme:mode', mode);
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.textContent = `Theme: ${mode === 'ambient' ? 'Ambient' : 'Pink'}`;
      });
    }
    // init
    syncDevUI();
  });
})();

function setActiveTab(tab) {
  // Use DOM to avoid hard failures if ids change
    const tabsEl = document.querySelector('.tabs');
    const tabButtons = tabsEl ? Array.from(tabsEl.querySelectorAll('.tab')) : [];
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
      // a11y: clear current page marker on all tabs
      try { btn.removeAttribute('aria-current'); } catch {}
      const id = btn.id && btn.id.startsWith('tab-') ? btn.id.slice(4) : null;
      if (id) {
        const section = document.getElementById('tab-content-' + id);
        if (section) section.style.display = 'none';
      }
    });
    const targetBtn = document.getElementById('tab-' + tab);
    const targetSection = document.getElementById('tab-content-' + tab);
    if (targetSection) targetSection.style.display = 'block';
    if (targetBtn) {
      targetBtn.classList.add('active');
      // a11y: mark the active tab as current page
      try { targetBtn.setAttribute('aria-current', 'page'); } catch {}
    }
    // animate indicator after layout
    requestAnimationFrame(updateTabsIndicator);
    // Move focus to main content for accessibility when tab changes
    try {
      const main = document.getElementById('main');
      if (main) main.setAttribute('tabindex','-1'), main.focus();
    } catch {}
  }

// Keep indicator aligned on resize
window.addEventListener('resize', () => requestAnimationFrame(updateTabsIndicator));
// Bidirectional scroll reveal: animate in on enter, reverse on exit (up-scroll)
(function() {
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function allRevealEls() { return Array.from(document.querySelectorAll('.reveal')); }
  let lastY = 0;
  let direction = 'down';
  function onScrollDir() {
    const y = window.scrollY || 0;
    direction = y > lastY ? 'down' : y < lastY ? 'up' : direction;
    lastY = y;
  }
  window.addEventListener('scroll', onScrollDir, { passive: true });
  window.addEventListener('DOMContentLoaded', onScrollDir);

  function handle(entries) {
    entries.forEach(entry => {
      const el = entry.target;
  const isBounce = el.classList.contains('bounce');
  const isScrub = el.classList.contains('scrub') || el.closest('.scrub');
      // Stagger setup
      const siblings = Array.from(el.parentElement?.querySelectorAll('.reveal') || []);
      const idx = Math.max(0, siblings.indexOf(el));
      const delay = Math.min(idx * 80, 480);
  if (!prefersReduced && !isBounce && !isScrub) el.style.transitionDelay = `${delay}ms`;

      if (entry.isIntersecting) {
        // Enter viewport: reveal forward
        el.classList.add('revealed');
        if (isBounce) el.classList.remove('reverse');
      } else {
        // Exit viewport: if scrolling up, reverse; if down, keep hidden state for next entry
  if (direction === 'up') {
          if (isBounce) {
            // Trigger reverse direction for keyframes
            el.classList.add('reverse');
            // Re-run animation by toggling revealed to restart when it re-enters
            el.classList.remove('revealed');
            // Force reflow to allow reverse animation when it becomes visible again
            void el.offsetWidth; // no-op
          } else {
            el.classList.remove('revealed');
          }
        }
      }
    });
  }
  window.addEventListener('DOMContentLoaded', function() {
    const els = allRevealEls();
    if (!els.length) return;
    // Skip wiring when Safe Mode enabled
    if (document.documentElement.classList.contains('safe-mode')) {
      els.forEach(el => el.classList.add('revealed'));
      return;
    }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(handle, { threshold: [0, 0.15, 0.5, 1], rootMargin: '0px 0px -8% 0px' });
      els.forEach(el => io.observe(el));
    } else {
      // No IO: just reveal and skip reversals
      els.forEach(el => el.classList.add('revealed'));
    }
  });
})();

// Parallax scroll for fixed background layer
(function() {
  window.addEventListener('DOMContentLoaded', function() {
    const bg = document.querySelector('.scroll-bg');
    if (!bg) return;
  if (document.documentElement.classList.contains('safe-mode')) return;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        bg.style.transform = `translate3d(0, ${(-0.04 * y).toFixed(2)}px, 0)`;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });
})();

// Scroll progress bar (cursor aura removed)
(function interactiveChrome() {
  window.addEventListener('DOMContentLoaded', function() {
  const bar = document.querySelector('.scroll-progress__bar');

    // Progress bar
    if (bar) {
      const onScroll = () => {
        const h = document.documentElement;
        const max = (h.scrollHeight - h.clientHeight) || 1;
        const p = Math.min(1, Math.max(0, (h.scrollTop || window.scrollY || 0) / max));
        bar.style.width = (p * 100).toFixed(2) + '%';
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

  });
})();

// Creative blobs parallax based on scroll and cursor
(function blobsParallax() {
  window.addEventListener('DOMContentLoaded', function() {
    const blobs = Array.from(document.querySelectorAll('.creative-blob'));
    if (!blobs.length) return;
  if (document.documentElement.classList.contains('safe-mode')) return;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
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
          const depth = (i + 1) * 0.04; // vary subtly per blob
          const px = (mx - 0.5) * 30 * (i + 1);
          const py = (my - 0.5) * 30 * (i + 1);
          b.style.transform = `translate3d(${px.toFixed(1)}px, ${(-y * depth + py).toFixed(1)}px, 0)`;
        });
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });
})();

// Scroll-scrub engine for interactive freeze/reverse/resume
(function scrollScrub() {
  const supportsIO = 'IntersectionObserver' in window;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let items = [];
  function collect() {
    items = Array.from(document.querySelectorAll('.scroll-animate')).map(el => {
      const effect = el.dataset.effect || 'slide-x';
      const distX = parseFloat(el.dataset.x || '120') || 120;
      const distY = parseFloat(el.dataset.y || '120') || 120;
      const scaleFrom = parseFloat(el.dataset.scaleFrom || '0.94') || 0.94;
      const scaleTo = parseFloat(el.dataset.scaleTo || '1') || 1;
      const rotFrom = parseFloat(el.dataset.rotFrom || el.dataset.rotateFrom || '-6') || -6;
      const rotTo = parseFloat(el.dataset.rotTo || el.dataset.rotateTo || '0') || 0;
      let fadeFrom = parseFloat(el.dataset.fadeFrom || '0.9') || 0.9; // less fade by default
      const fadeTo = parseFloat(el.dataset.fadeTo || '1') || 1;
      let blurFrom = parseFloat(el.dataset.blurFrom || '0.5') || 0.5; // near-zero default blur
      let blurTo = parseFloat(el.dataset.blurTo || '0') || 0;
      // Sensitivity: if user prefers reduced motion, remove blur and most fade
      if (prefersReduced) {
        fadeFrom = 0.98; // almost fully opaque
        blurFrom = 0;
        blurTo = 0;
      } else {
        // Clamp blur to a subtle range (0..1px)
        blurFrom = Math.min(1, Math.max(0, blurFrom));
      }
      return { el, effect, distX, distY, scaleFrom, scaleTo, rotFrom, rotTo, fadeFrom, fadeTo, blurFrom, blurTo };
    });
  }
  function progressFor(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Map center of element through viewport: 1 at top edge, 0 at bottom edge, clamp 0..1 and invert for forward scroll
    const center = rect.top + rect.height / 2;
    const p = 1 - Math.min(1, Math.max(0, center / Math.max(1, vh)));
    return p; // 0..1
  }
  function apply() {
    items.forEach(({ el, effect, distX, distY, scaleFrom, scaleTo, rotFrom, rotTo, fadeFrom, fadeTo, blurFrom, blurTo }) => {
      // Eased progress for more natural motion
      const raw = progressFor(el);
      const p = Math.min(1, Math.max(0, 1 - Math.pow(1 - raw, 1.6))); // ease-out
      // Compute pixel distance to travel; start off-screen, finish in place
      if (effect === 'slide-x') {
        const px = (1 - p) * distX; // at p=0 => distX, at p=1 => 0
        el.style.setProperty('--scrub', String(px));
        // subtle fade/blur coupled with slide for seamless feel
        const op = fadeFrom + (fadeTo - fadeFrom) * p;
        const br = blurFrom + (blurTo - blurFrom) * p;
        el.style.setProperty('--scrubOpacity', op.toFixed(3));
        el.style.setProperty('--scrubBlur', br.toFixed(2) + 'px');
      } else if (effect === 'slide-y') {
        const py = (1 - p) * distY;
        el.style.setProperty('--scrubY', String(py));
        const op = fadeFrom + (fadeTo - fadeFrom) * p;
        const br = blurFrom + (blurTo - blurFrom) * p;
        el.style.setProperty('--scrubOpacity', op.toFixed(3));
        el.style.setProperty('--scrubBlur', br.toFixed(2) + 'px');
      } else if (effect === 'scale') {
        const s = scaleFrom + (scaleTo - scaleFrom) * p;
        el.style.setProperty('--scrubScale', String(s));
      } else if (effect === 'rotate') {
        const deg = rotFrom + (rotTo - rotFrom) * p;
        el.style.setProperty('--scrubRot', deg.toFixed(2) + 'deg');
      } else if (effect === 'fade') {
        const op = fadeFrom + (fadeTo - fadeFrom) * p;
        el.style.setProperty('--scrubOpacity', op.toFixed(3));
      } else if (effect === 'blur') {
        const br = blurFrom + (blurTo - blurFrom) * p;
        el.style.setProperty('--scrubBlur', br.toFixed(2) + 'px');
      }
      // More effects can be added here (slide-y, scale, blur, etc.)
    });
  }
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { apply(); ticking = false; });
  }
  window.addEventListener('DOMContentLoaded', () => {
    collect();
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Re-collect if DOM changes (simple heuristic)
    const ro = new ResizeObserver(() => { collect(); apply(); });
    document.querySelectorAll('.scroll-animate').forEach(el => ro.observe(el));
  });
})();

// Magnetic hover: elements move slightly toward cursor
(function magneticHover() {
  window.addEventListener('DOMContentLoaded', function() {
    const items = Array.from(document.querySelectorAll('.cta-btn, .panel-tile, .project-icon-card, .tab'));
  if (document.documentElement.classList.contains('safe-mode')) return;
    items.forEach(el => {
      el.classList.add('magnetic');
      const rect = () => el.getBoundingClientRect();
      const onMove = (e) => {
        const r = rect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) / (r.width / 2);
        const dy = (e.clientY - cy) / (r.height / 2);
        const mag = 6; // px
        el.style.transform = `translate(${(dx * mag).toFixed(1)}px, ${(dy * mag).toFixed(1)}px)`;
      };
      const reset = () => { el.style.transform = ''; };
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', reset);
      el.addEventListener('blur', reset);
      el.addEventListener('touchend', reset, { passive: true });
    });
  });
})();

// Scroll-driven story activation with viewport progress
(function storyScrollActivate() {
  window.addEventListener('DOMContentLoaded', function() {
    // For each case-story section, wire independent IO and activation
    document.querySelectorAll('.case-story').forEach(section => {
      const steps = Array.from(section.querySelectorAll('.story-step'));
      const stage = section.querySelector('.story-stage') || document.getElementById('story-stage');
      if (!steps.length || !stage) return;
      const panels = {
        problem: stage.querySelector('.stage-problem'),
        approach: stage.querySelector('.stage-approach'),
        impact: stage.querySelector('.stage-impact'),
      };
      const opt = { threshold: [0, 0.5, 1] };
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.target.dataset.story) return;
          const key = e.target.dataset.story;
          if (e.intersectionRatio >= 0.5) {
            steps.forEach(s => {
              const isActive = s === e.target;
              s.classList.toggle('active', isActive);
              try { s.setAttribute('aria-pressed', isActive ? 'true' : 'false'); } catch {}
            });
            Object.keys(panels).forEach(k => panels[k]?.classList.toggle('show', k === key));
          }
        });
      }, opt);
      steps.forEach(s => io.observe(s));
    });
  });
})();
// Count-up animation for .stat-number when visible
(function() {
  function animateCount(el, to) {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { el.textContent = Number(to).toLocaleString(); return; }
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      const v = Math.round((from + (to - from) * easeOut(p)) * 100) / 100;
      el.textContent = v.toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  window.addEventListener('DOMContentLoaded', function() {
    const stats = Array.from(document.querySelectorAll('.stat-number'));
    if (!stats.length) return;
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target.querySelector ? e.target.querySelector('.stat-number') : null;
          const node = el || (e.target.classList?.contains('stat-number') ? e.target : null);
          if (!node) { io.unobserve(e.target); return; }
          const raw = node.dataset.target || node.textContent || '0';
          const target = parseFloat(String(raw).replace(/[^\d.]/g, '')) || 0;
          animateCount(node, target);
          io.unobserve(e.target);
        });
      }, { threshold: 0.4 });
      // Observe the stat cards for better viewport intersection
      document.querySelectorAll('.stat-card').forEach(card => io.observe(card));
    } else {
      stats.forEach((node) => {
        const raw = node.dataset.target || node.textContent || '0';
        const target = parseFloat(String(raw).replace(/[^\d.]/g, '')) || 0;
        node.textContent = Number(target).toLocaleString();
      });
    }
  });
})();

// Splash / Welcome intro logic
function buildLetters(el, text) {
  el.textContent = '';
  const frag = document.createDocumentFragment();
  Array.from(text).forEach((ch, idx) => {
    const span = document.createElement('span');
    if (ch === ' ') {
      span.className = 'space';
      span.textContent = '\u00A0';
    } else {
      span.textContent = ch;
    }
  span.style.animationDelay = (idx * 85) + 'ms';
    frag.appendChild(span);
  });
  el.appendChild(frag);
}

function showSplash(durationOverride) {
  return new Promise(resolve => {
    const splash = document.getElementById('splash');
    if (!splash) return resolve();
  // Ensure splash is positioned under loader immediately to avoid visual gap
  try { splash.style.display = 'grid'; splash.removeAttribute('aria-hidden'); } catch {}
    // Ensure splash avatar image is loaded and visible
    try {
      const avImg = splash.querySelector('.splash-avatar img');
      if (avImg) {
        avImg.style.visibility = 'visible';
        if (!avImg.complete) {
          const onErr = () => {
            // cache-bust retry once
            avImg.onerror = null;
            avImg.src = 'idle_animation.gif?v=' + Date.now();
          };
          avImg.addEventListener('error', onErr, { once: true });
        }
      }
    } catch {}
    const line1 = document.getElementById('splash-line-1');
    const line2 = document.getElementById('splash-line-2');
    const t1 = line1?.getAttribute('data-text') || 'Welcome';
    const t2 = line2?.getAttribute('data-text') || '';
    buildLetters(line1, t1);
    buildLetters(line2, t2);
    splash.style.display = 'grid';
    splash.removeAttribute('aria-hidden');
    // trigger animations
    requestAnimationFrame(() => {
      splash.querySelectorAll('.letters span').forEach(s => s.classList.add('show'));
    });
    const prompt = document.getElementById('splash-prompt');
    const inner = document.querySelector('.splash-inner');
    let finished = false;
    let onMove;
    let timer;
    const cleanup = () => {
      window.removeEventListener('keydown', keyAny);
      splash.removeEventListener('click', clickAny);
      if (inner) {
        inner.classList.remove('tilt');
        if (onMove) window.removeEventListener('mousemove', onMove);
        inner.style.removeProperty('--tiltX');
        inner.style.removeProperty('--tiltY');
      }
    };
    function mountHeroAvatar() {
      const heroSlot = document.getElementById('hero-avatar-slot');
      if (!heroSlot) return;
      heroSlot.style.visibility = 'visible';
      heroSlot.innerHTML = '';
      const holder = document.createElement('div');
      holder.className = 'avatar';
      const img = document.createElement('img');
      img.src = 'idle_animation.gif';
      img.alt = 'Profile animation';
      holder.appendChild(img);
      heroSlot.appendChild(holder);
    }
    const done = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      // Handle avatar transition safely based on current UI state
      try {
        const splashAvatar = document.querySelector('#splash .avatar');
        const heroSlot = document.getElementById('hero-avatar-slot');
        const portfolio = document.getElementById('portfolio-box');
        const portfolioVisible = !!(portfolio && getComputedStyle(portfolio).display !== 'none');
        const heroVisible = !!(heroSlot && heroSlot.offsetWidth > 0 && heroSlot.offsetHeight > 0 && getComputedStyle(heroSlot).display !== 'none');

        // If portfolio is visible and hero slot is visible, perform FLIP now
        if (splashAvatar && heroVisible && portfolioVisible) {
          const clone = splashAvatar.cloneNode(true);
          const srcRect = splashAvatar.getBoundingClientRect();
          const fly = document.createElement('div');
          fly.className = 'splash-flyer';
          fly.style.position = 'fixed';
          fly.style.left = srcRect.left + 'px';
          fly.style.top = srcRect.top + 'px';
          fly.style.width = srcRect.width + 'px';
          fly.style.height = srcRect.height + 'px';
          fly.style.zIndex = 10001;
          fly.style.willChange = 'transform, opacity';
          fly.style.transformOrigin = 'top left';
          fly.appendChild(clone);
          // Pause inner avatar glow/shadow during flight
          try {
            const inner = fly.querySelector('.avatar');
            if (inner) {
              inner.style.animationPlayState = 'paused';
              inner.style.boxShadow = 'none';
              inner.style.filter = 'none';
            }
          } catch {}
          document.body.appendChild(fly);
          // Hide original to avoid double-vision
          splashAvatar.style.visibility = 'hidden';
          // Measure destination and animate immediately
          const destRect = heroSlot.getBoundingClientRect();
          const dx = destRect.left - srcRect.left;
          const dy = destRect.top - srcRect.top;
          const sx = destRect.width / (srcRect.width || 1);
          const sy = destRect.height / (srcRect.height || 1);
          fly.style.transition = 'transform 680ms cubic-bezier(.2,.7,.2,1), opacity 680ms ease';
          requestAnimationFrame(() => {
            fly.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
            fly.style.opacity = '0.995';
          });
          setTimeout(() => {
            // Mount final avatar into hero slot and cleanup
            try {
              heroSlot.style.visibility = 'visible';
              heroSlot.innerHTML = '';
              const holder = document.createElement('div');
              holder.className = 'avatar';
              const img = document.createElement('img');
              img.src = 'idle_animation.gif';
              img.alt = 'Profile animation';
              holder.appendChild(img);
              heroSlot.appendChild(holder);
            } catch {}
            try { document.body.removeChild(fly); } catch {}
          }, 840);
          // Ensure no deferred flyer remains
          window.__flyAvatar = null;
        } else if (splashAvatar && !portfolioVisible) {
          // Portfolio hidden (e.g., post-login path) -> defer FLIP to revealPortfolio as before
          const clone = splashAvatar.cloneNode(true);
          const srcRect = splashAvatar.getBoundingClientRect();
          const fly = document.createElement('div');
          fly.className = 'splash-flyer';
          fly.style.position = 'fixed';
          fly.style.left = srcRect.left + 'px';
          fly.style.top = srcRect.top + 'px';
          fly.style.width = srcRect.width + 'px';
          fly.style.height = srcRect.height + 'px';
          fly.style.zIndex = 10001;
          fly.style.willChange = 'transform, opacity';
          fly.style.transformOrigin = 'top left';
          fly.appendChild(clone);
          try {
            const inner = fly.querySelector('.avatar');
            if (inner) {
              inner.style.animationPlayState = 'paused';
              inner.style.boxShadow = 'none';
              inner.style.filter = 'none';
            }
          } catch {}
          document.body.appendChild(fly);
          splashAvatar.style.visibility = 'hidden';
          window.__flyAvatar = { fly, srcRect, startedAt: performance.now() };
        } else {
          // Either there is no splash avatar or hero slot isn't visible; ensure no stale flyer exists
          window.__flyAvatar = null;
        }
      } catch {}
      splash.style.display = 'none';
      splash.setAttribute('aria-hidden', 'true');
      cleanup();
      resolve();
    };
    const clickAny = (e) => {
      // Ignore clicks on skip to let it handle itself
      if (e.target && (e.target.id === 'splash-skip')) return;
      done();
    };
    const keyAny = () => done();
    if (prompt) {
      prompt.addEventListener('click', done);
      prompt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') done(); });
    }
    splash.addEventListener('click', clickAny);
    window.addEventListener('keydown', keyAny);
  // disable tilt on splash per request; no parallax or cursor tilt
  // Extend duration based on actual letters so animation always finishes
  const spans = splash.querySelectorAll('.letters span');
  const PER_LETTER_DELAY = 85;      // Keep in sync with buildLetters
  const LETTER_ANIM_DURATION = 1100; // Keep in sync with CSS .letters span.show animation
  const BUFFER = 600;
  const MIN_TOTAL = 2600;
  const needed = Math.max(MIN_TOTAL, ((spans.length - 1) * PER_LETTER_DELAY) + LETTER_ANIM_DURATION + BUFFER);
  const totalTime = Math.max(needed, durationOverride || 0);
  timer = setTimeout(() => { done(); }, totalTime);
    // if user interacts, clear timer via done()
  });
}

// Centralized portfolio reveal to keep tabs/indicator working consistently
function revealPortfolio() {
  wireTabs();
  // Ensure login is hidden when revealing main portfolio
  try { const loginBox = document.getElementById('login-box'); if (loginBox) loginBox.style.display = 'none'; } catch {}
  const portfolio = document.getElementById('portfolio-box');
  const headerLogo = document.getElementById('header-logo');
  if (portfolio) portfolio.style.display = 'block';
  if (headerLogo) headerLogo.style.display = 'none';
  // Hide any loading overlay just in case
  try { const l = document.getElementById('login-loading'); if (l) l.style.display = 'none'; } catch {}
  const sidebar = document.getElementById('sidebar-left');
  if (sidebar) sidebar.style.display = 'block';
  const sidebarR = document.getElementById('sidebar-right');
  if (sidebarR) sidebarR.style.display = 'block';
  setActiveTab('home');
  const logoutTabBtn = document.querySelector('.logout-tab-btn');
  if (logoutTabBtn) {
    logoutTabBtn.classList.remove('hide');
    logoutTabBtn.classList.add('show');
  }
  requestAnimationFrame(updateTabsIndicator);
  // Ensure hero avatar is mounted if splash was skipped (no pending flyer)
  try {
    if (!window.__flyAvatar) {
      const slot = document.getElementById('hero-avatar-slot');
      if (slot && !slot.querySelector('.avatar')) {
        const holder = document.createElement('div');
        holder.className = 'avatar';
        const img = document.createElement('img');
        img.src = 'idle_animation.gif';
        img.alt = 'Profile animation';
        holder.appendChild(img);
        slot.style.visibility = 'visible';
        slot.appendChild(holder);
      }
  // Show bubble regardless of whether avatar was newly mounted or already present
  showAvatarBubble();
    }
  } catch {}
  // Helper: show a pixel speech bubble near the avatar for a short time
  function showAvatarBubble() {
    try {
      const slot = document.getElementById('hero-avatar-slot');
      if (!slot) return;
      // Remove any existing bubble first to avoid duplicates
      const prev = document.querySelector('.speech-bubble');
      if (prev) prev.remove();
      const bubble = document.createElement('div');
      bubble.className = 'speech-bubble';
      let msg = 'Welcome! feel free to explore!';
      try {
        const returning = sessionStorage.getItem('profile:returning') === '1';
        const fullName = localStorage.getItem('profile:currentName') || '';
        if (returning && fullName) {
          msg = `Welcome Back! ${fullName}`;
        }
      } catch {}
      bubble.textContent = msg;
      // Mount to body so it can overlap containers with overflow hidden
      document.body.appendChild(bubble);
      bubble.style.position = 'fixed';
      bubble.style.zIndex = '10002';
      // Position updater: keep bubble anchored on scroll/resize
      let rafId = null;
      const onScrollOrResize = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          try {
            bubble.classList.remove('pos-right','pos-above');
            const nameEl = document.querySelector('.hero-header-text');
            const slotRect = slot.getBoundingClientRect();
            // If avatar not visible or zero-sized, hide bubble quietly
            const inView = slotRect.width > 0 && slotRect.height > 0 && slotRect.bottom > 0 && slotRect.top < (window.innerHeight || 0);
            if (!inView) {
              bubble.style.opacity = '0';
              return;
            } else {
              bubble.style.opacity = '';
            }
            // Default: right side
            bubble.classList.add('pos-right');
            bubble.style.left = Math.round(slotRect.right + 10) + 'px';
            bubble.style.top = Math.round(slotRect.top - 10) + 'px';
            const bubRect = bubble.getBoundingClientRect();
            const nameRect = nameEl ? nameEl.getBoundingClientRect() : null;
            const fitsRight = bubRect.right <= (window.innerWidth - 8);
            const overlapsName = !!(nameRect && !(bubRect.right < nameRect.left || bubRect.left > nameRect.right || bubRect.bottom < nameRect.top || bubRect.top > nameRect.bottom));
            if (!fitsRight || overlapsName) {
              // Above the avatar
              bubble.classList.remove('pos-right');
              bubble.classList.add('pos-above');
              const refreshRect = bubble.getBoundingClientRect();
              const w = refreshRect.width || bubRect.width;
              const h = refreshRect.height || bubRect.height;
              const left = Math.round(Math.min(slotRect.left, Math.max(8, window.innerWidth - w - 8)));
              const top = Math.round(Math.max(8, slotRect.top - (h + 8)));
              bubble.style.left = left + 'px';
              bubble.style.top = top + 'px';
            }
          } catch {}
        });
      };
      // Initial measure and wire events
      onScrollOrResize();
      window.addEventListener('scroll', onScrollOrResize, { passive: true });
      window.addEventListener('resize', onScrollOrResize);
      // Stagger slight delay to allow CSS transition
      setTimeout(() => bubble.classList.add('show'), 60);
      // Auto-hide after 4 seconds
      setTimeout(() => {
        bubble.classList.remove('show');
        setTimeout(() => {
          try {
            window.removeEventListener('scroll', onScrollOrResize);
            window.removeEventListener('resize', onScrollOrResize);
            if (rafId) cancelAnimationFrame(rafId);
            bubble.remove();
          } catch {}
        }, 260);
      }, 4000);
    } catch {}
  }
  // If there is a pending flyer from splash, complete FLIP animation now
  try {
  if (window.__flyAvatar) {
      const { fly, srcRect } = window.__flyAvatar;
      const heroSlot = document.getElementById('hero-avatar-slot');
      if (fly && heroSlot) {
        // Ensure special class is present to allow smooth transition in safe-mode
        try { fly.classList.add('splash-flyer'); } catch {}
        // Measure destination now that layout is ready
        heroSlot.style.visibility = 'hidden';
        const destRect = heroSlot.getBoundingClientRect();
        if (!destRect || destRect.width === 0 || destRect.height === 0) {
          // Fallback: mount immediately and remove flyer
          heroSlot.style.visibility = 'visible';
          heroSlot.innerHTML = '';
          const holder = document.createElement('div');
          holder.className = 'avatar';
          const img = document.createElement('img');
          img.src = 'idle_animation.gif';
          img.alt = 'Profile animation';
          holder.appendChild(img);
          heroSlot.appendChild(holder);
          // Show bubble now that avatar is mounted
          showAvatarBubble();
          try { document.body.removeChild(fly); } catch {}
          window.__flyAvatar = null;
          return;
        }
        const dx = destRect.left - srcRect.left;
        const dy = destRect.top - srcRect.top;
        const sx = destRect.width / (srcRect.width || 1);
        const sy = destRect.height / (srcRect.height || 1);
        fly.style.transition = 'transform 680ms cubic-bezier(.2,.7,.2,1), opacity 680ms ease';
        fly.style.transformOrigin = 'top left';
        // Animate
        requestAnimationFrame(() => {
          fly.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
          fly.style.opacity = '0.995';
        });
        setTimeout(() => {
          // Mount the final avatar and cleanup
          const slot = document.getElementById('hero-avatar-slot');
          if (slot) {
            heroSlot.style.visibility = 'visible';
            heroSlot.innerHTML = '';
            const holder = document.createElement('div');
            holder.className = 'avatar';
            const img = document.createElement('img');
            img.src = 'idle_animation.gif';
            img.alt = 'Profile animation';
            holder.appendChild(img);
            heroSlot.appendChild(holder);
            // Now that the avatar is mounted, show the bubble
            showAvatarBubble();
          }
          try { document.body.removeChild(fly); } catch {}
          window.__flyAvatar = null;
        }, 840);
      }
    }
  } catch {}
}

// Delegate tab clicks to ensure switching works even if inline handlers fail
function wireTabs() {
  const tabs = document.querySelector('.tabs');
  if (!tabs || tabs.__wired) return;
  tabs.__wired = true;
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const id = btn.id && btn.id.startsWith('tab-') ? btn.id.slice(4) : null;
    if (id) {
      e.preventDefault();
      setActiveTab(id);
    }
  });
}

// Animated tab indicator using a DOM element
function updateTabsIndicator() {
  const tabs = document.querySelector('.tabs');
  if (!tabs) return;
  let indicator = tabs.querySelector('.tab-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'tab-indicator';
    tabs.prepend(indicator);
  }
  const active = tabs.querySelector('.tab.active') || tabs.querySelector('.tab');
  if (!active) return;
  const tabsRect = tabs.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const x = activeRect.left - tabsRect.left;
  const w = activeRect.width;
  indicator.style.width = w + 'px';
  indicator.style.transform = `translateX(${Math.round(x)}px)`;
}

// ----- Command-K Quick Action Palette -----
(function commandPalette() {
  const overlay = document.getElementById('cmdk');
  if (!overlay) return;
  const panel = overlay.querySelector('.cmdk-panel');
  const input = overlay.querySelector('#cmdk-input');
  const list = overlay.querySelector('#cmdk-list');
  let items = [];
  let filtered = [];
  let index = 0;

  // Sound + Haptics
  const FX = {
    sound: localStorage.getItem('fx:sound') !== 'off',
    haptics: localStorage.getItem('fx:haptics') !== 'off',
  };
  function saveFX() {
    localStorage.setItem('fx:sound', FX.sound ? 'on' : 'off');
    localStorage.setItem('fx:haptics', FX.haptics ? 'on' : 'off');
  }
  let audioCtx;
  function ctx() {
    if (!FX.sound) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function beep({ freq = 660, dur = 0.06, type = 'sine', vol = 0.07 } = {}) {
    const c = ctx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(c.destination);
    const now = c.currentTime;
    osc.start(now);
    // quick decay
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.01), now + dur);
    osc.stop(now + dur);
  }
  const sfx = {
    open: () => { beep({ freq: 820, dur: 0.05, type: 'triangle', vol: 0.06 }); },
    close: () => { beep({ freq: 240, dur: 0.06, type: 'sine', vol: 0.06 }); },
    select: () => { beep({ freq: 680, dur: 0.06, type: 'square', vol: 0.06 }); },
    move: () => { beep({ freq: 520, dur: 0.03, type: 'sine', vol: 0.045 }); },
  };
  function haptic(pattern = 8) {
    if (!FX.haptics || !('vibrate' in navigator)) return;
    try { navigator.vibrate(pattern); } catch {}
  }

  function collectActions() {
    const out = [];
    // Settings
    out.push({
      label: `Safe Mode (${document.documentElement.classList.contains('safe-mode') ? 'On' : 'Off'})`,
      desc: 'Reduce motion, remove blur and effects',
      keywords: ['safe','reduce','motion','blur','accessibility'],
      run: () => {
        const on = !document.documentElement.classList.contains('safe-mode');
        document.documentElement.classList.toggle('safe-mode', on);
        try { localStorage.setItem('ux:safeMode', on ? 'on' : 'off'); } catch {}
        items = collectActions();
        filtered = items.slice();
        render();
      }
    });
    out.push({
      label: `Toggle Sound (${FX.sound ? 'On' : 'Off'})`,
      desc: 'Enable/disable palette sounds',
      keywords: ['mute', 'sound', 'audio'],
      run: () => { FX.sound = !FX.sound; saveFX(); sfx.select(); filtered = filter(input.value); render(); }
    });
    out.push({
      label: `Toggle Haptics (${FX.haptics ? 'On' : 'Off'})`,
      desc: 'Enable/disable vibration feedback',
      keywords: ['haptics', 'vibrate', 'vibration'],
      run: () => { FX.haptics = !FX.haptics; saveFX(); haptic(6); filtered = filter(input.value); render(); }
    });
  // Mood themes
  out.push({ label: 'Theme: Pink', desc: 'Default pink gradient', keywords: ['theme','pink','default'], run: () => applyTheme('pink') });
  out.push({ label: 'Theme: Ambient', desc: 'Auto-accent from avatar', keywords: ['theme','ambient','auto'], run: () => applyTheme('ambient') });
  out.push({ label: 'Theme: Focus', desc: 'Lower saturation, high contrast', keywords: ['theme','focus','contrast'], run: () => applyTheme('focus') });
  out.push({ label: 'Theme: Noir', desc: 'Monochrome vibe', keywords: ['theme','noir','mono'], run: () => applyTheme('noir') });
  out.push({ label: 'Theme: Retro Pixel', desc: 'Chunky fonts and scanlines', keywords: ['theme','retro','pixel'], run: () => applyTheme('retro') });
    // Pet quick actions (if available)
    try {
      const petAvail = typeof window.__petIsHidden === 'function';
      const petHidden = petAvail ? !!window.__petIsHidden() : false;
      const petLabel = petAvail ? (petHidden ? 'Pet: Show' : 'Pet: Hide') : 'Pet: Toggle';
      out.push({
        label: petLabel,
        desc: 'Toggle pixel pet visibility',
        keywords: ['pet','show','hide','pixel','buddy'],
        run: () => { try { window.__petToggle && window.__petToggle(); } catch {} }
      });
      out.push({
        label: 'Pet: Settings',
        desc: 'Rename your pet',
        keywords: ['pet','settings','name','rename'],
        run: () => { try { window.__openPetSettings && window.__openPetSettings(); } catch {} }
      });
    } catch {}
    // Tabs
    document.querySelectorAll('.tabs .tab').forEach(btn => {
      const id = btn.id?.replace('tab-','');
      if (!id) return;
      out.push({
        label: btn.textContent.trim(),
        desc: 'Go to tab',
        keywords: [id, btn.textContent.trim().toLowerCase()],
        run: () => setActiveTab(id)
      });
    });
    // Projects in coding grid
    document.querySelectorAll('.portfolio-grid .project-icon-card').forEach(a => {
      const title = a.getAttribute('data-title') || a.getAttribute('aria-label') || 'Open project';
      const href = a.getAttribute('href');
      out.push({ label: title, desc: 'Open project', keywords: [title.toLowerCase()], run: () => { window.location.href = href; }});
    });
  // Quick actions
    const actions = [
  { label: 'My Info', desc: 'Open About tab', run: () => setActiveTab('about'), keywords: ['about', 'info', 'me'] },
  { label: 'Explore Work', desc: 'Open Coding tab', run: () => setActiveTab('coding'), keywords: ['work', 'coding', 'projects'] },
  { label: 'Contact', desc: 'Open Contact tab', run: () => setActiveTab('contact'), keywords: ['contact', 'email'] },
  { label: 'Download Resume (Under maintenance)', desc: 'Temporarily disabled', run: () => {
    try {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = 'Resume download is under maintenance.';
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { try { toast.remove(); } catch {} }, 260); }, 2000);
    } catch {}
  }, keywords: ['resume', 'download'] },
      { label: 'Install App', desc: window.__pwaInstallAvailable ? 'Install this portfolio as an app' : 'Install not available', run: async () => { if (window.requestPWAInstall) await window.requestPWAInstall(); }, keywords: ['pwa', 'install', 'app'] },
      { label: 'Show Intro', desc: 'Replay the splash intro', run: async () => { try { sessionStorage.removeItem('splashSeen'); } catch {}; await showSplash(); }, keywords: ['intro','splash','welcome'] },
    ];
    actions.forEach(a => out.push(a));
    // Social links
    document.querySelectorAll('.side-rail .rail-item[href]').forEach(a => {
      const label = a.getAttribute('aria-label') || a.textContent.trim() || 'Open link';
      const href = a.getAttribute('href');
      out.push({ label, desc: 'Open link', keywords: [label.toLowerCase()], run: () => window.open(href, '_blank') });
    });
    return out;
  }

  function score(query, text) {
    // Simple case-insensitive substring priority; small bonus for startsWith
    const q = query.trim().toLowerCase();
    const t = text.toLowerCase();
    if (!q) return 0;
    if (t.startsWith(q)) return 100 - t.indexOf(q);
    const idx = t.indexOf(q);
    return idx === -1 ? -1 : 50 - idx;
  }

  function filter(q) {
    if (!q) return items.slice();
    const arr = [];
    items.forEach(it => {
      const s1 = score(q, it.label);
      const s2 = Math.max(...(it.keywords || []).map(k => score(q, k)));
      const s = Math.max(s1, s2);
      if (s >= 0) arr.push({ ...it, _s: s });
    });
    arr.sort((a,b) => b._s - a._s);
    // Return a generous number; scrolling will handle the rest
    return arr.slice(0, 200);
  }

  function render() {
    list.innerHTML = '';
    filtered.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'cmdk-item';
      li.setAttribute('role', 'option');
      if (i === index) li.setAttribute('aria-selected', 'true');
      li.innerHTML = `<span class="cmdk-label">${it.label}</span><span class="cmdk-desc">${it.desc || ''}</span>`;
  li.addEventListener('mouseenter', () => { index = i; render(); });
      li.addEventListener('click', () => run(i));
      list.appendChild(li);
    });
    // Ensure the selected item is scrolled into view
    const selected = list.querySelector('.cmdk-item[aria-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function run(i) {
    const it = filtered[i];
    if (!it) return;
  sfx.select();
  haptic([10, 40, 16]);
    close();
    setTimeout(() => it.run && it.run(), 0);
  }

  function open() {
    items = collectActions();
    filtered = items.slice();
    index = 0;
    render();
    overlay.style.display = 'grid';
    overlay.classList.add('show');
    overlay.removeAttribute('aria-hidden');
    input.value = '';
    input.focus();
  sfx.open();
  haptic(8);
  }
  function close() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = 'none';
  sfx.close();
  haptic(4);
  }

  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay.style.display === 'grid') close(); else open();
    }
    if (overlay.style.display !== 'grid') return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); index = Math.min(index + 1, filtered.length - 1); render(); sfx.move(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); index = Math.max(index - 1, 0); render(); sfx.move(); }
  if (e.key === 'PageDown') { e.preventDefault(); index = Math.min(index + 5, filtered.length - 1); render(); sfx.move(); }
  if (e.key === 'PageUp') { e.preventDefault(); index = Math.max(index - 5, 0); render(); sfx.move(); }
  if (e.key === 'Home') { e.preventDefault(); index = 0; render(); sfx.move(); }
  if (e.key === 'End') { e.preventDefault(); index = Math.max(filtered.length - 1, 0); render(); sfx.move(); }
    if (e.key === 'Enter') { e.preventDefault(); run(index); }
  });
  input?.addEventListener('input', (e) => { filtered = filter(e.target.value); index = 0; render(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
})();

// ----- 3D tilt interactions on cards -----
(function tiltify() {
  const supportsMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!supportsMotion) return;
  const MAX_TILT = 10; // degrees
  function applyTilt(el, e) {
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    const rx = (py - 0.5) * -2 * MAX_TILT;
    const ry = (px - 0.5) * 2 * MAX_TILT;
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }
  function resetTilt(el) {
    el.style.transform = '';
  }
  function wire(el) {
    el.classList.add('tiltable');
    el.addEventListener('mousemove', (e) => applyTilt(el, e));
    el.addEventListener('mouseleave', () => resetTilt(el));
    el.addEventListener('mouseenter', (e) => applyTilt(el, e));
    // Touch: slight tilt on touchmove
    el.addEventListener('touchmove', (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      applyTilt(el, t);
    }, { passive: true });
    el.addEventListener('touchend', () => resetTilt(el));
  }
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.panel-tile, .project-icon-card').forEach(wire);
  });
})();

// ---- Theme system ----
function applyTheme(mode = 'pink') {
  const root = document.documentElement;
  root.classList.remove('theme-ambient','theme-focus','theme-noir','theme-retro');
  switch (mode) {
    case 'ambient':
      root.classList.add('theme-ambient');
      extractAvatarPalette().then(colors => {
        if (colors) {
          setAmbientColors(colors);
        }
      });
      break;
    case 'focus':
      root.classList.add('theme-ambient','theme-focus');
      setAmbientColors({ primary: '#5b4bd6', accent: '#1f9a6a', hot: '#d43a54' });
      break;
    case 'noir':
      root.classList.add('theme-ambient','theme-noir');
      setAmbientColors({ primary: '#2b2b2b', accent: '#555', hot: '#777' });
      break;
    case 'retro':
      root.classList.add('theme-ambient','theme-retro');
      setAmbientColors({ primary: '#ff7a00', accent: '#00c2ff', hot: '#ff2e63' });
      break;
    case 'pink':
    default:
      // reset to defaults; pink gradient remains by CSS
      setAmbientColors({ primary: getCss('--brand-primary'), accent: getCss('--brand-accent'), hot: getCss('--brand-hot') });
      break;
  }
}
function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function setAmbientColors({ primary, accent, hot }) {
  const root = document.documentElement;
  if (primary) root.style.setProperty('--ambient-primary', primary);
  if (accent) root.style.setProperty('--ambient-accent', accent);
  if (hot) root.style.setProperty('--ambient-hot', hot);
}
async function extractAvatarPalette() {
  try {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = 'idle_animation.gif';
    await new Promise((res, rej) => { img.onload = () => res(); img.onerror = () => res(); });
    const canvas = document.createElement('canvas');
    const w = canvas.width = Math.min(64, img.naturalWidth || 64);
    const h = canvas.height = Math.min(64, img.naturalHeight || 64);
    const ctx2 = canvas.getContext('2d');
    ctx2.drawImage(img, 0, 0, w, h);
    const data = ctx2.getImageData(0, 0, w, h).data;
    // Simple average with bias to more saturated pixels
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i], G = data[i+1], B = data[i+2], A = data[i+3];
      if (A < 128) continue;
      const max = Math.max(R,G,B), min = Math.min(R,G,B);
      const sat = (max - min) / (max || 1);
      const wgt = 0.5 + sat; // 0.5..1.5
      r += R * wgt; g += G * wgt; b += B * wgt; count += wgt;
    }
    if (count === 0) return null;
    r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
    const primary = `rgb(${r}, ${g}, ${b})`;
    // Derive an accent by rotating hue roughly 120deg (quick-and-dirty)
    const accent = rotateHue(r,g,b,120);
    const hot = rotateHue(r,g,b,-60);
    return { primary, accent, hot };
  } catch { return null; }
}
function rotateHue(r,g,b,deg) {
  // Convert to HSL, rotate, back to RGB
  const { h, s, l } = rgbToHsl(r,g,b);
  let nh = (h + deg/360) % 1; if (nh < 0) nh += 1;
  const { r: R, g: G, b: B } = hslToRgb(nh, s, l);
  return `rgb(${Math.round(R*255)}, ${Math.round(G*255)}, ${Math.round(B*255)})`;
}
function rgbToHsl(r,g,b){ r/=255; g/=255; b/=255; const max=Math.max(r,g,b),min=Math.min(r,g,b); let h,s,l=(max+min)/2; if(max===min){h=s=0;} else { const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6;} return {h,s,l}; }
function hslToRgb(h,s,l){ let r,g,b; if(s===0){r=g=b=l;} else { const hue2rgb=(p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; }; const q=l<0.5?l*(1+s):l+s-l*s; const p=2*l-q; r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);} return {r,g,b}; }

// ---- Storytelling wiring ----
window.addEventListener('DOMContentLoaded', () => {
  const stage = document.getElementById('story-stage');
  if (!stage) return;
  const steps = Array.from(document.querySelectorAll('.story-step'));
  const panels = {
    problem: stage.querySelector('.stage-problem'),
    approach: stage.querySelector('.stage-approach'),
    impact: stage.querySelector('.stage-impact'),
  };
  steps.forEach(step => {
    step.addEventListener('mouseenter', () => activate(step.dataset.story));
    step.addEventListener('focus', () => activate(step.dataset.story));
    step.addEventListener('click', () => activate(step.dataset.story));
    // a11y: keyboard activation for role="button" story steps
    step.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        activate(step.dataset.story);
      }
    });
  });
  function activate(key){
    steps.forEach(s => {
      const isActive = s.dataset.story===key;
      s.classList.toggle('active', isActive);
      // a11y: keep aria-pressed updated
      try { s.setAttribute('aria-pressed', isActive ? 'true' : 'false'); } catch {}
    });
    Object.keys(panels).forEach(k => panels[k]?.classList.toggle('show', k===key));
  }
});

// ---- Privacy Manager (view/delete intake entries) ----
async function openPrivacyManager() {
  const modal = document.getElementById('privacy-modal');
  const list = document.getElementById('privacy-list');
  const closeBtn = document.getElementById('privacy-close');
  if (!modal || !list) return;
  list.innerHTML = '<div style="padding:0.8rem;opacity:0.8;">Loading…</div>';
  modal.style.display = 'grid';
  modal.classList.add('show');
  modal.removeAttribute('aria-hidden');
  closeBtn && (closeBtn.onclick = () => closePrivacyManager());
  modal.addEventListener('click', (e) => { if (e.target === modal) closePrivacyManager(); });
  try {
    const fullName = (localStorage.getItem('profile:currentName') || '').trim();
    const [first, ...rest] = fullName.split(/\s+/);
    const last = rest.join(' ').trim();
    if (!first || !last) {
      list.innerHTML = '<div style="padding:0.8rem;">Please enter your name above and continue first. Then reopen this manager to view or delete your entry.</div>';
      return;
    }
    const params = new URLSearchParams();
    if (first) params.set('first', first);
    if (last) params.set('last', last);
    const BASE = window.__BACKEND_URL || 'http://localhost:3001';
    const r = await fetch(BASE + '/intake/entries' + (params.toString() ? ('?' + params.toString()) : ''));
    if (!r.ok) throw new Error('Failed to load entries');
    const data = await r.json();
    renderPrivacyList(Array.isArray(data.entries) ? data.entries : []);
  } catch (e) {
    list.innerHTML = '<div style="padding:0.8rem;color:#ef4565;font-weight:600;">Error loading entries.</div>';
  }
}
function closePrivacyManager() {
  const modal = document.getElementById('privacy-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
}
function renderPrivacyList(entries) {
  const list = document.getElementById('privacy-list');
  if (!list) return;
  if (!entries.length) {
    list.innerHTML = '<div style="padding:0.8rem;opacity:0.8;">No entries found for your current name.</div>';
    return;
  }
  list.innerHTML = '';
  entries.forEach(ent => {
    const row = document.createElement('div');
    row.className = 'cmdk-item';
    row.innerHTML = `<div class="cmdk-label" style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
      <span style="font-weight:700;">${escapeHtml(ent.first)} ${escapeHtml(ent.last)}</span>
      <span style="opacity:0.75;">${escapeHtml(ent.type)}</span>
      <span style="opacity:0.6;">${escapeHtml(ent.school || ent.company || '')}</span>
      <span style="margin-left:auto;opacity:0.6;">${escapeHtml(ent.ts)}</span>
    </div>
    <div class="cmdk-desc">
      <button class="theme-toggle" data-ts="${encodeURIComponent(ent.ts)}">Delete</button>
    </div>`;
    list.appendChild(row);
  });
  // Wire deletes
  list.querySelectorAll('button[data-ts]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const ts = e.currentTarget.getAttribute('data-ts');
      if (!ts) return;
      if (!confirm('Delete this entry on the server?')) return;
      try {
        const BASE = window.__BACKEND_URL || 'http://localhost:3001';
        const r = await fetch(BASE + '/intake?ts=' + ts, { method: 'DELETE' });
        if (!r.ok) throw new Error('Delete failed');
        // Remove row from UI
        const row = e.currentTarget.closest('.cmdk-item');
        row && row.remove();
        if (!list.children.length) list.innerHTML = '<div style="padding:0.8rem;opacity:0.8;">No entries left.</div>';
      } catch {
        alert('Failed to delete. Please try again.');
      }
    });
  });
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

// ---- Resume/CV download helper ----
function downloadResumeAndCV() {
  // Disabled: show notice instead of downloading
  try {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = 'Resume download is under maintenance.';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { try { toast.remove(); } catch {} }, 260); }, 2000);
  } catch {}
}

// Global guard: block any direct attempts to open or download resume.pdf
window.addEventListener('click', (e) => {
  try {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href.endsWith('resume.pdf') || href.includes('/resume.pdf')) {
      e.preventDefault();
      downloadResumeAndCV();
    }
  } catch {}
}, true);

// Back-compat: inline onclick="showTab('home')" still present in HTML
function showTab(tab) { try { setActiveTab(tab); } catch {} }

// ----- Spotlight fallback (dimming siblings when one is hovered/focused) -----
(function spotlightFallback() {
  function wire(containerSelector, itemSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    let active = null;
    const items = Array.from(container.querySelectorAll(itemSelector));
    if (!items.length) return;
    function activate(el) {
      active = el;
      container.classList.add('spotlight');
      items.forEach(it => it.classList.toggle('is-hovered', it === el));
    }
    function deactivate() {
      active = null;
      container.classList.remove('spotlight');
      items.forEach(it => it.classList.remove('is-hovered'));
    }
    items.forEach(it => {
      it.addEventListener('mouseenter', () => activate(it));
      it.addEventListener('focus', () => activate(it));
      it.addEventListener('mouseleave', () => { if (active === it) deactivate(); });
      it.addEventListener('blur', () => { if (active === it) deactivate(); });
    });
    container.addEventListener('mouseleave', deactivate);
  }
  window.addEventListener('DOMContentLoaded', () => {
    wire('.hero-panel', '.panel-tile');
    wire('.portfolio-grid', '.project-icon-card');
  });
})();

// ----- Developer Mode (grid + FPS): Shift + D -----
(function devMode() {
  let enabled = false;
  let gridEl, fpsEl;
  let rafId = null;
  function enable() {
    if (enabled) return;
    enabled = true;
    gridEl = document.createElement('div');
    gridEl.className = 'dev-grid-overlay';
    document.body.appendChild(gridEl);
    fpsEl = document.createElement('div');
    fpsEl.className = 'dev-fps-badge';
    fpsEl.textContent = 'FPS';
    document.body.appendChild(fpsEl);
    // FPS meter
    let last = performance.now();
    let frames = 0;
    let fps = 0;
    function loop(now) {
      frames++;
      if (now - last >= 500) { // update twice per second
        fps = Math.round(frames * 1000 / (now - last));
        fpsEl.textContent = `${fps} FPS`;
        frames = 0;
        last = now;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }
  function disable() {
    if (!enabled) return;
    enabled = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (gridEl) gridEl.remove();
    if (fpsEl) fpsEl.remove();
  }
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      if (enabled) { disable(); } else { enable(); }
    }
  });
})();

// ----- Konami-code Easter egg: 8-bit Mode (CRT + Confetti) -----
(function eightBitMode() {
  const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;
  let active = false;
  let overlay = null;
  let timeoutId = null;
  let toast = null;

  function fireConfetti() {
    // Skip confetti in safe-mode
    if (document.documentElement.classList.contains('safe-mode')) return;
    const colors = ['#7f5af0','#2cb67d','#ef4565','#ffbd68','#00c2ff'];
    const N = 70;
    for (let i=0; i<N; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const left = Math.round((Math.random()*100)) + 'vw';
      el.style.left = left;
      el.style.background = colors[i % colors.length];
      el.style.setProperty('--dur', (1400 + Math.random()*1400) + 'ms');
      el.style.transform = `rotate(${Math.round(Math.random()*360)}deg)`;
      document.body.appendChild(el);
      // Cleanup each piece
      setTimeout(() => { try { el.remove(); } catch {} }, 3000);
    }
  }

  function enable() {
    if (active) return;
    active = true;
    document.documentElement.classList.add('mode-8bit');
    overlay = document.createElement('div');
    overlay.className = 'crt-overlay';
    document.body.appendChild(overlay);
  // Allow click to disable early
  overlay.addEventListener('click', () => disable(), { once: true });
    // Trigger fade-in
    requestAnimationFrame(() => overlay.classList.add('show'));
    // Feedback toast
    try {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = '8-bit Mode!';
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => { try { toast.classList.remove('show'); } catch {} }, 1500);
      setTimeout(() => { try { toast.remove(); } catch {} }, 1900);
    } catch {}
    fireConfetti();
  try { if (typeof awardAchievement === 'function') awardAchievement('konami_master'); } catch {}
    // Auto-disable after 8s
    timeoutId = setTimeout(disable, 8000);
  }

  function disable() {
    if (!active) return;
    active = false;
    document.documentElement.classList.remove('mode-8bit');
    if (overlay) {
      overlay.classList.remove('show');
      overlay.classList.add('fade-out');
      setTimeout(() => { try { overlay.remove(); } catch {} }, 420);
      overlay = null;
    }
  if (toast) { try { toast.remove(); } catch {}; toast = null; }
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const expect = seq[pos];
    const match = (expect.length === 1) ? (key === expect) : (e.key === expect);
    if (match) {
      pos++;
      if (pos === seq.length) { pos = 0; if (!active) enable(); }
    } else {
      pos = 0;
    }
    // Manual disable with Escape
    if (e.key === 'Escape' && active) {
      disable();
    }
  });
})();

// ----- PWA Install Prompt handling -----
(function pwaInstall() {
  let deferred;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    // expose to command palette via global setter
    window.__pwaInstallAvailable = true;
  });
  window.addEventListener('appinstalled', () => {
    window.__pwaInstallAvailable = false;
    deferred = null;
  try { if (typeof awardAchievement === 'function') awardAchievement('pwa_installed'); } catch {}
  });
  window.requestPWAInstall = async function() {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    window.__pwaInstallAvailable = false;
    return outcome === 'accepted';
  }
})();
// (sticky CTA wiring added above in bootstrap)

// ---- Prefetch internal .html on hover/focus/touch (performance polish) ----
(function linkPrefetch() {
  window.addEventListener('DOMContentLoaded', () => {
    const prefetched = new Set();
    function prefetch(href) {
      if (!href || prefetched.has(href)) return;
      try {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return; // same-origin only
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = url.href;
        document.head.appendChild(link);
        prefetched.add(url.href);
      } catch {}
    }
    const sel = 'a[href$=".html"]:not([data-no-prefetch])';
    document.querySelectorAll(sel).forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const on = () => prefetch(href);
      a.addEventListener('mouseenter', on, { once: true });
      a.addEventListener('focus', on, { once: true });
      a.addEventListener('touchstart', on, { once: true, passive: true });
    });
  });
})();

// ===== Achievements: local per-name with optional backend sync =====
(function achievements() {
  const BADGES = [
    { id: 'first_visit', label: 'First Visit' },
    { id: 'konami_master', label: '8-bit Mode' },
    { id: 'pwa_installed', label: 'Installed App' },
    { id: 'resume_analyzed', label: 'Resume Analyzed' },
  ];
  function currentNameKey() {
    try {
      const full = (localStorage.getItem('profile:currentName') || '').trim();
      if (!full) return null;
      return `ach:${full.toLowerCase()}`;
    } catch { return null; }
  }
  function readAch() {
    try {
      const key = currentNameKey();
      if (!key) return {};
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function writeAch(obj) {
    try {
      const key = currentNameKey();
      if (!key) return;
      localStorage.setItem(key, JSON.stringify(obj || {}));
    } catch {}
  }
  function render() {
    const wrap = document.getElementById('badges');
    if (!wrap) return;
    const haveName = !!currentNameKey();
    const have = readAch();
    wrap.innerHTML = '';
    BADGES.forEach(b => {
      const el = document.createElement('div');
      const owned = !!have[b.id];
      el.className = 'badge' + (owned ? '' : ' locked');
      el.setAttribute('data-id', b.id);
      el.setAttribute('role', 'listitem');
      el.title = owned ? `Unlocked on ${have[b.id]}` : 'Locked';
      el.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${b.label}</span>`;
      wrap.appendChild(el);
    });
    const syncBtn = document.getElementById('sync-ach');
    const resetBtn = document.getElementById('reset-ach');
    if (syncBtn) syncBtn.disabled = !haveName;
    if (resetBtn) resetBtn.disabled = !haveName;
  }
  async function syncWithServer() {
    const full = (localStorage.getItem('profile:currentName') || '').trim();
    if (!full) return false;
    const [first, ...rest] = full.split(/\s+/);
    const last = rest.join(' ');
    const BASE = window.__BACKEND_URL || 'http://localhost:3001';
    try {
      const r = await fetch(`${BASE}/achievements?first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}`, { cache: 'no-store' });
      const srv = r.ok ? await r.json() : { badges: {} };
      const local = readAch();
      const merged = { ...srv.badges, ...local };
      for (const id of Object.keys(merged)) {
        if (!srv.badges || !srv.badges[id]) {
          try {
            await fetch(`${BASE}/achievements/award`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first, last, badge: id }) });
          } catch {}
        }
      }
      writeAch(merged);
      render();
      return true;
    } catch { return false; }
  }
  function award(id) {
    if (!id) return false;
    const now = new Date().toISOString();
    const have = readAch();
    if (!have[id]) {
      have[id] = now;
      writeAch(have);
      render();
      return true;
    }
    return false;
  }
  // Expose minimal API
  window.awardAchievement = award;
  window.syncAchievements = syncWithServer;
  // Auto-award first visit after intake success
  const origShowIntakeSummary = window.showIntakeSummary;
  window.showIntakeSummary = function(...args) {
    try { award('first_visit'); } catch {}
    return origShowIntakeSummary.apply(this, args);
  };
  // Wire UI
  window.addEventListener('DOMContentLoaded', () => {
    render();
    const syncBtn = document.getElementById('sync-ach');
    const resetBtn = document.getElementById('reset-ach');
    if (syncBtn && !syncBtn.__wired) {
      syncBtn.__wired = true;
      syncBtn.addEventListener('click', async () => { syncBtn.disabled = true; await syncWithServer(); syncBtn.disabled = false; });
    }
    if (resetBtn && !resetBtn.__wired) {
      resetBtn.__wired = true;
      resetBtn.addEventListener('click', () => {
        if (!confirm('Clear your local badges?')) return;
        writeAch({});
        render();
      });
    }
  });
  // Refresh badges when active profile changes
  try { window.addEventListener('profile:changed', () => render()); } catch {}
})();

// Postcard feature removed

// ===== Pixel Pet (walking + hiding + cursor play) =====
(function pixelPetAdvanced() {
  window.addEventListener('DOMContentLoaded', () => {
  const widget = document.getElementById('pixel-pet');
    if (!widget) return;
    // Per-profile namespacing helpers
    function activeProfileName() {
      try { return (localStorage.getItem('profile:currentName') || '').trim().toLowerCase() || null; } catch { return null; }
    }
    function petKey(suffix) {
      const prof = activeProfileName();
      return prof ? `pet:${prof}:${suffix}` : `pet:${suffix}`;
    }
    // Key suffixes (used via petKey())
    const LV_KEY = 'level';
    const XP_KEY = 'xp';
    const NAME_KEY = 'name';
    const HIDE_KEY = 'hidden';
    const FEED_KEY = 'feedCount';
    const PLAY_KEY = 'playCount';
    // Migrate legacy global pet keys into current profile once
    (function migrateLegacyPet(){
      try {
        const prof = activeProfileName();
        if (!prof) return;
        const marker = `pet:${prof}:migrated`;
        if (localStorage.getItem(marker) === '1') return;
        const legacy = {
          level: localStorage.getItem('pet:level'),
          xp: localStorage.getItem('pet:xp'),
          name: localStorage.getItem('pet:name'),
          hidden: localStorage.getItem('pet:hidden'),
          feedCount: localStorage.getItem('pet:feedCount'),
          playCount: localStorage.getItem('pet:playCount'),
        };
        const any = Object.values(legacy).some(v => v != null);
        if (any) {
          if (legacy.level != null) localStorage.setItem(petKey('level'), legacy.level);
          if (legacy.xp != null) localStorage.setItem(petKey('xp'), legacy.xp);
          if (legacy.name != null) localStorage.setItem(petKey('name'), legacy.name);
          if (legacy.hidden != null) localStorage.setItem(petKey('hidden'), legacy.hidden);
          if (legacy.feedCount != null) localStorage.setItem(petKey('feedCount'), legacy.feedCount);
          if (legacy.playCount != null) localStorage.setItem(petKey('playCount'), legacy.playCount);
        }
        localStorage.setItem(marker, '1');
      } catch {}
    })();
    const DAILY_LIMIT = 3; // clicks per day per action
    let level = parseInt(localStorage.getItem(petKey(LV_KEY)) || '1', 10) || 1;
    let xp = parseInt(localStorage.getItem(petKey(XP_KEY)) || '0', 10) || 0;
    const badge = widget.querySelector('.lv-badge');
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const safeMode = document.documentElement.classList.contains('safe-mode') || prefersReduced;
    // Name: render small label in widget
  let petName = (localStorage.getItem(petKey(NAME_KEY)) || 'Buddy').trim().slice(0, 24) || 'Buddy';
    let nameEl = widget.querySelector('.pet-name');
    if (!nameEl) {
      nameEl = document.createElement('span');
      nameEl.className = 'pet-name';
      Object.assign(nameEl.style, { fontWeight: '700', fontSize: '0.8rem', color: '#232526', marginLeft: '4px' });
      widget.appendChild(nameEl);
    }
    nameEl.textContent = petName;

    // Helpers: daily counter state with midnight reset
    const todayKey = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    };
    function readCount(key){
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '{}');
        if (!raw || raw.day !== todayKey()) return { day: todayKey(), count: 0 };
        return { day: raw.day, count: Math.max(0, parseInt(raw.count||0,10)||0) };
      } catch { return { day: todayKey(), count: 0 }; }
    }
    function writeCount(key, obj){
      try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
    }
    function incCount(key){
      const cur = readCount(key);
      const next = { day: todayKey(), count: cur.count + 1 };
      writeCount(key, next);
      return next.count;
    }
    function resetIfNewDay(){
      const f = readCount(petKey(FEED_KEY)), p = readCount(petKey(PLAY_KEY)); // read ensures reset
      writeCount(petKey(FEED_KEY), { day: todayKey(), count: f.day===todayKey()?f.count:0 });
      writeCount(petKey(PLAY_KEY), { day: todayKey(), count: p.day===todayKey()?p.count:0 });
    }
    function msToMidnight(){
      const now = new Date();
      const end = new Date(now);
      end.setHours(24,0,0,0);
      return Math.max(0, end.getTime() - now.getTime());
    }
    function fmtHMS(ms){
      const s = Math.floor(ms/1000);
      const h = Math.floor(s/3600);
      const m = Math.floor((s%3600)/60);
      const ss = s%60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    }
    function needXP(lv) { return 5 + (lv - 1) * 3; }
  function save() { try { localStorage.setItem(petKey(LV_KEY), String(level)); localStorage.setItem(petKey(XP_KEY), String(xp)); } catch {} }
    function render() { if (badge) badge.textContent = `Lv${level}`; }
    function gain(n = 1) {
      xp += n;
      if (xp >= needXP(level)) { xp = 0; level++; cueLevelUp(); }
      save(); render();
    }
    function cueLevelUp() {
      widget.classList.add('level-up'); setTimeout(() => widget.classList.remove('level-up'), 800);
      // happy hop
      if (pet) { pet.classList.add('pet-hop'); setTimeout(()=>pet.classList.remove('pet-hop'), 600); }
      // Pixel arrow + LVL UP label
      try {
        emote('arrow');
        // Pixel LVL UP text
        const label = document.createElement('div');
        label.textContent = 'LVL UP';
        Object.assign(label.style, {
          position: 'fixed', left: '0', top: '0', zIndex: 10041, pointerEvents: 'none',
          transform: `translate(${Math.round(pos.x + 8)}px, ${Math.round(pos.y - 20)}px)`,
          transition: 'transform 900ms ease, opacity 900ms ease',
          font: '700 10px monospace', color: '#b7ffcf', textShadow: '0 1px 0 #0a4', opacity: '1'
        });
        document.body.appendChild(label);
        requestAnimationFrame(() => {
          label.style.transform = `translate(${Math.round(pos.x + 8)}px, ${Math.round(pos.y - 48)}px)`;
          label.style.opacity = '0';
        });
        setTimeout(()=>{ try { label.remove(); } catch {} }, 1000);
      } catch {}
    }

    // Floating pet element (uses sprite frames drawn to data URLs)
  const pet = document.createElement('div');
    pet.className = 'pet-follower';
    pet.setAttribute('aria-hidden', 'true');
    const sprite = document.createElement('img');
    sprite.alt = '';
  sprite.width = 48; sprite.height = 48; sprite.style.imageRendering = 'pixelated';
    pet.appendChild(sprite);
    document.body.appendChild(pet);

    // Basic styles (inline): use transform translate for absolute placement, top/left at 0
    Object.assign(pet.style, {
      position: 'fixed', left: '0px', top: '0px', zIndex: 10040,
      width: '48px', height: '48px', display: 'grid', placeItems: 'center',
      transform: 'translate(40px, 70vh)',
      transition: 'transform 180ms ease, opacity 200ms ease',
      filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.15))',
  pointerEvents: 'auto', fontSize: '24px', cursor: 'grab', touchAction: 'none'
    });
  // Respect saved hidden state immediately
  if (localStorage.getItem(petKey(HIDE_KEY)) === '1') { pet.style.opacity = '0'; }

  let state = 'idle'; // idle | walk | hide | chase | sleep
  let petHidden = (localStorage.getItem(petKey(HIDE_KEY)) === '1');
    let target = { x: 40, y: window.innerHeight * 0.7 };
    let pos = { x: target.x, y: target.y };
    let vx = 0, vy = 0;
    const SPEED = 1.4; // px per frame
    const CHASE_SPEED = 2.1;
  const HIDE_PROB = 0.25; // chance to hide near a card
  const CURSOR_PLAY_PROB = 0.0; // disable cursor chase; platform-only behavior
  let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

    // --- Drag to move ---
  let dragging = false;
  let didMove = false;
    let dragStart = { x: 0, y: 0 };
    let dragOffset = { x: 24, y: 24 }; // pointer-to-top-left offset
    // pointer velocity sampling for momentum
    let moveSamples = [];
    function recordSample(x, t) {
      moveSamples.push({ x, t });
      // keep last ~120ms of samples
      const cutoff = t - 140;
      while (moveSamples.length && moveSamples[0].t < cutoff) moveSamples.shift();
      if (moveSamples.length > 6) moveSamples.shift();
    }
    function onPointerDown(e) {
      if (petHidden) return; // ignore when hidden
      const isPrimary = e.isPrimary !== false; if (!isPrimary) return;
  dragging = true; didMove = false; pet.style.cursor = 'grabbing'; resetIdle(); state = 'drag'; path = null; currentEl = null; patrolTargetPx = null; varG_vy = 0;
      dragStart.x = e.clientX; dragStart.y = e.clientY;
      dragOffset.x = e.clientX - pos.x; dragOffset.y = e.clientY - pos.y;
      moveSamples = []; recordSample(e.clientX, performance.now());
      try { pet.setPointerCapture && pet.setPointerCapture(e.pointerId); } catch {}
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      // keep inside viewport
      const vw = window.innerWidth, vh = window.innerHeight;
      pos.x = Math.max(4, Math.min(vw - 52, x));
  pos.y = Math.max(4, Math.min(vh - 52, y));
  const movedNow = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
  if (movedNow > 6) didMove = true;
      recordSample(e.clientX, performance.now());
    }
    let lastPetReact = 0;
    function petReact(kind) {
      const now = Date.now(); if (now - lastPetReact < 180) return; lastPetReact = now;
      if (kind === 'love') emote('heart');
      else if (kind === 'happy') emote('happy');
      else if (kind === 'angry') emote('angry');
    }
  function onPointerUp(e) {
      if (!dragging) return;
      dragging = false; pet.style.cursor = 'grab';
      try { pet.releasePointerCapture && pet.releasePointerCapture(e.pointerId); } catch {}
      const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
      // Treat as a click if barely moved
      if (!didMove || moved < 8) {
        // top-click detection using bounding rect (top half)
        const rect = pet.getBoundingClientRect();
        const localY = e.clientY - rect.top;
        const topClicked = localY <= rect.height * 0.5;
        if (topClicked) {
          const r = Math.random();
          const kind = r < 0.5 ? 'love' : r < 0.8 ? 'happy' : 'angry';
          petReact(kind);
        } else {
          emote('arrow');
          if (currentEl) { planPatrol(); } else {
            const els = collectPlatformEls(); if (els.length) sitOn(els[0], pos.x);
          }
        }
        return;
      }
      // Compute horizontal throw velocity (px/ms) from recent samples
      let throwVx = 0;
      try {
        const n = moveSamples.length;
        if (n >= 2) {
          const a = moveSamples[0];
          const b = moveSamples[n - 1];
          const dt = Math.max(1, b.t - a.t);
          throwVx = (b.x - a.x) / dt; // px per ms
          // clamp
          const MAX_VX = 1.2; // ~1200px/s
          if (throwVx > MAX_VX) throwVx = MAX_VX;
          if (throwVx < -MAX_VX) throwVx = -MAX_VX;
        }
      } catch {}
      // Drop: sit on a platform under x, else fall
      let best = null; let bestDy = Infinity;
      const plats = collectPlatformEls();
      for (const el of plats) {
        const b = boundsFor(el);
        const minX = Math.max(8, b.left + MARGIN);
        const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
        const topY = Math.round(b.top - PET_H);
        // Consider platforms where x fits and top is near current y
        if (pos.x >= minX && pos.x <= maxX) {
          const dy = Math.abs(topY - pos.y);
          if (dy < bestDy) { bestDy = dy; best = { el, x: pos.x, y: topY }; }
        }
      }
      if (best && bestDy <= 120) {
        sitOn(best.el, best.x);
      } else {
        // let gravity handle the fall from current pos
        currentEl = null; state = 'fall'; varG_vy = 0; varG_vx = throwVx;
      }
    }
    // Use Pointer Events if available, fallback to mouse/touch
    if ('onpointerdown' in window) {
      pet.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    } else {
      pet.addEventListener('mousedown', (e)=>onPointerDown(e));
      window.addEventListener('mousemove', (e)=>onPointerMove(e), { passive: true });
      window.addEventListener('mouseup', (e)=>onPointerUp(e));
      pet.addEventListener('touchstart', (e)=>{ const t=e.touches[0]; if(!t) return; onPointerDown(t); }, { passive: true });
      window.addEventListener('touchmove', (e)=>{ const t=e.touches[0]; if(!t) return; onPointerMove(t); }, { passive: true });
      window.addEventListener('touchend', (e)=>{ const t=e.changedTouches && e.changedTouches[0]; if(!t) return; onPointerUp(t); });
      window.addEventListener('touchcancel', (e)=>{ const t=e.changedTouches && e.changedTouches[0]; if(!t) return; onPointerUp(t); });
      // Click fallback: treat top-half click as petting
      pet.addEventListener('click', (e) => {
        if (petHidden) return;
        const rect = pet.getBoundingClientRect();
        const localY = (e.clientY ?? 0) - rect.top;
        if (localY <= rect.height * 0.5) {
          const r = Math.random();
          const kind = r < 0.5 ? 'love' : r < 0.8 ? 'happy' : 'angry';
          petReact(kind);
        }
      });
    }

    // Sprite frames (PNG via canvas -> dataURL)
    const SPRITES = buildSprites();
    let facing = 1; // 1 right, -1 left
    let frameIndex = 0;
    let frameTimer = 0;
  function setSprite(name) {
      const frames = SPRITES[name] || SPRITES.idle;
      sprite.src = frames[frameIndex % frames.length];
    }

  // Emotes (pixel heart/star/arrow; zzz) + feed/play icon effects
    function emote(kind = 'heart') {
      const EMOTES = buildEmotes();
      const key = (kind === 'zzz') ? 'zzz' : kind;
      let url = null;
      if (key === 'feed') url = ICONS?.drum;
      else if (key === 'play') url = ICONS?.ball;
      else url = EMOTES[key];
      if (url) {
        const img = document.createElement('img');
        img.src = url; img.alt = ''; img.width = 16; img.height = 16; img.style.imageRendering = 'pixelated';
        const x0 = Math.round(pos.x + 24 - 8);
        const y0 = Math.round(pos.y - 8);
        Object.assign(img.style, {
          position: 'fixed', left: '0', top: '0', zIndex: 10041, pointerEvents: 'none',
          transform: `translate(${x0}px, ${y0}px)`,
          transition: 'transform 800ms ease, opacity 800ms ease',
          opacity: '1', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.2))'
        });
        document.body.appendChild(img);
        requestAnimationFrame(() => {
          img.style.transform = `translate(${x0}px, ${Math.round(y0 - 28)}px)`;
          img.style.opacity = '0';
        });
        setTimeout(() => { try { img.remove(); } catch {} }, 900);
        return;
      }
      // no fallback needed
    }

    // Tiny pixel UI icons for Feed/Play buttons and meter
    function buildPetIcons() {
      function make(draw) {
        const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d');
        g.clearRect(0,0,16,16); draw(g); return c.toDataURL('image/png');
      }
      const DRUM = make((g)=>{
        // meat
        const O='#5a3b1a', F='#d97b2d', H='#ffbe85', B='#cfcfcf', BO='#9a9a9a';
        g.fillStyle=O; g.fillRect(2,6,7,1); g.fillRect(2,7,1,3); g.fillRect(8,7,1,3); g.fillRect(3,10,6,1);
        g.fillStyle=F; g.fillRect(3,7,5,3);
        g.fillStyle=H; g.fillRect(4,8,2,1);
        // bone
        g.fillStyle=BO; g.fillRect(9,8,1,1); g.fillRect(11,8,1,1); g.fillRect(10,9,1,2);
        g.fillStyle=B; g.fillRect(10,8,1,1); g.fillRect(9,9,3,1); g.fillRect(10,10,1,1);
      });
      const BALL = make((g)=>{
        const O='#213547', W='#ffffff', K='#111';
        // outline circle
        g.fillStyle=O; g.fillRect(5,3,6,1); g.fillRect(4,4,1,8); g.fillRect(11,4,1,8); g.fillRect(5,12,6,1);
        // fill
        g.fillStyle=W; g.fillRect(5,4,6,8);
        // simple pentagon-ish spots
        g.fillStyle=K; g.fillRect(7,6,2,1); g.fillRect(6,7,1,2); g.fillRect(9,7,1,2); g.fillRect(7,9,2,1);
      });
      return { drum: DRUM, ball: BALL };
    }
    const ICONS = buildPetIcons();

    // Feed/Play actions UI next to widget
  const actions = document.createElement('div');
  actions.className = 'pet-actions';
  Object.assign(actions.style, { display:'grid', gap:'6px', marginTop:'6px' });
    const row1 = document.createElement('div');
    Object.assign(row1.style, { display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' });
    row1.innerHTML = `
      <button class="theme-toggle" data-act="feed" aria-label="Feed pet"><img class="pet-ico" src="${ICONS.drum}" alt="" aria-hidden="true"/>Feed</button>
      <button class="theme-toggle" data-act="play" aria-label="Play with pet"><img class="pet-ico" src="${ICONS.ball}" alt="" aria-hidden="true"/>Play</button>
      <button class="theme-toggle" data-act="toggle" aria-label="Show or hide pet">${petHidden ? 'Show Pet' : 'Hide Pet'}</button>
      <button class="theme-toggle" data-act="settings" aria-label="Open pet settings">Settings</button>
    `;
    const meter = document.createElement('div');
    meter.className = 'pet-meter';
    Object.assign(meter.style, { opacity:'0.95', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' });
    meter.innerHTML = `
      <span class="pet-chip" id="pet-chip-feed"><img class="pet-ico" src="${ICONS.drum}" alt="" aria-hidden="true"/>FEED <span class="pet-num" id="pet-feed-num">0/3</span></span>
      <span class="pet-chip" id="pet-chip-play"><img class="pet-ico" src="${ICONS.ball}" alt="" aria-hidden="true"/>PLAY <span class="pet-num" id="pet-play-num">0/3</span></span>
      <span class="pet-reset" id="pet-reset-in" style="margin-left:auto;">reset in 00:00:00</span>
    `;
    actions.appendChild(row1);
    actions.appendChild(meter);
    // Prefer mounting into Pet tab panel if present, otherwise keep near sidebar widget
  // Prefer right-rail mount if available
  const rightRailMount = document.getElementById('pet-rail-mount');
  const mountTarget = rightRailMount || widget;
  mountTarget.insertAdjacentElement('afterend', actions);

    // Settings panel (collapsible)
  const settings = document.createElement('div');
    settings.className = 'pet-settings';
    Object.assign(settings.style, {
      display:'none', padding:'8px', border:'1px solid var(--card-border)', borderRadius:'10px', background:'#fff', boxShadow:'var(--shadow-s)'
    });
    settings.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <label for="pet-name-input" style="font-weight:700;">Pet name</label>
        <input id="pet-name-input" type="text" value="${petName.replace(/"/g,'&quot;')}" maxlength="24" style="flex:1; min-width:120px; padding:6px 8px; border:1px solid var(--card-border); border-radius:8px;" aria-label="Pet name"/>
        <button class="theme-toggle" data-act="save-name">Save</button>
      </div>
      <div style="font-size:0.75rem;opacity:0.75;margin-top:6px;">Tip: Give your buddy a short, fun name. Max 24 chars.</div>
    `;
  actions.insertAdjacentElement('afterend', settings);

    function updateName(newName){
      petName = (newName||'').trim().slice(0,24) || 'Buddy';
      nameEl.textContent = petName;
      try { localStorage.setItem(petKey(NAME_KEY), petName); } catch {}
  // No-op for rail summary
    }

    function usesLeftFor(key){
      const cur = readCount(key); return Math.max(0, DAILY_LIMIT - cur.count);
    }
    function refreshLimitsUI(){
  const fUsed = Math.min(DAILY_LIMIT, readCount(petKey(FEED_KEY)).count);
  const pUsed = Math.min(DAILY_LIMIT, readCount(petKey(PLAY_KEY)).count);
  const fRemain = Math.max(0, DAILY_LIMIT - fUsed);
  const pRemain = Math.max(0, DAILY_LIMIT - pUsed);
      const feedNum = meter.querySelector('#pet-feed-num');
      const playNum = meter.querySelector('#pet-play-num');
  if (feedNum) feedNum.textContent = `${fRemain}/${DAILY_LIMIT}`;
  if (playNum) playNum.textContent = `${pRemain}/${DAILY_LIMIT}`;
      // Enable/disable buttons
      const btnFeed = row1.querySelector('button[data-act="feed"]');
      const btnPlay = row1.querySelector('button[data-act="play"]');
      if (btnFeed) btnFeed.disabled = fUsed >= DAILY_LIMIT;
      if (btnPlay) btnPlay.disabled = pUsed >= DAILY_LIMIT;
  // No-op for rail summary
    }
    function refreshCountdown(){
      const ms = msToMidnight();
      const el = meter.querySelector('#pet-reset-in');
      if (el) el.textContent = `reset in ${fmtHMS(ms)}`;
      // Always ensure new-day reset
      resetIfNewDay();
      refreshLimitsUI();
    }
    resetIfNewDay();
    refreshLimitsUI();
    refreshCountdown();
    const countdownTimer = setInterval(refreshCountdown, 1000);

    row1.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const act = btn.getAttribute('data-act');
  if (act === 'feed') {
        if (usesLeftFor(petKey(FEED_KEY)) <= 0) return;
    incCount(petKey(FEED_KEY)); refreshLimitsUI(); emote('heart'); emote('feed'); gain(2); wakeUp();
      }
      if (act === 'play') {
        if (usesLeftFor(petKey(PLAY_KEY)) <= 0) return;
  incCount(petKey(PLAY_KEY)); refreshLimitsUI(); emote('star'); emote('play'); gain(3); wakeUp();
  runUntilTs = Date.now() + RUN_BOOST_MS;
        // Nudge into a fun move along/among platforms
        if (currentEl) {
          (Math.random() < 0.5 ? planPatrol : pickParkour)();
        } else {
          const els = collectPlatformEls(); if (els.length) sitOn(els[0]);
        }
      }
      if (act === 'toggle') {
        petHidden = !petHidden; localStorage.setItem(petKey(HIDE_KEY), petHidden ? '1' : '0');
        const tBtn = row1.querySelector('button[data-act="toggle"]'); if (tBtn) tBtn.textContent = petHidden ? 'Show Pet' : 'Hide Pet';
        // Soft hide
        if (petHidden) { pet.style.opacity = '0'; } else { pet.style.opacity = '1'; }
      }
      if (act === 'settings') {
        const show = settings.style.display !== 'block';
        settings.style.display = show ? 'block' : 'none';
      }
    });
    settings.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act="save-name"]'); if (!b) return;
      const input = settings.querySelector('#pet-name-input');
      updateName(input && input.value);
      // gentle feedback
      settings.style.boxShadow = '0 0 0 2px #2cb67d40';
      setTimeout(()=>{ try { settings.style.boxShadow = 'var(--shadow-s)'; } catch {} }, 380);
    });

    // Expose quick helpers for Command-K palette
    window.__petIsHidden = () => petHidden;
    window.__petToggle = () => {
      petHidden = !petHidden; localStorage.setItem(petKey(HIDE_KEY), petHidden ? '1' : '0');
      const tBtn = row1.querySelector('button[data-act="toggle"]'); if (tBtn) tBtn.textContent = petHidden ? 'Show Pet' : 'Hide Pet';
      pet.style.opacity = petHidden ? '0' : '1';
    };
    window.__openPetSettings = () => {
      const show = settings.style.display !== 'block';
      settings.style.display = show ? 'block' : 'none';
      if (show) {
        const input = settings.querySelector('#pet-name-input');
        input && input.focus();
      }
    };

    let idleSince = Date.now();
    function resetIdle() { idleSince = Date.now(); }
    // Platform-only locomotion (tops of hero/cards). Anchor to current element so scroll doesn't move pet relative to it.
    const PLATFORM_SELECTORS = '.panel-tile, .case-card, .card, .hero-glass, .hero-panel';
    const PET_W = 48, PET_H = 48, MARGIN = 8;
    function collectPlatformEls() {
      return Array.from(document.querySelectorAll(PLATFORM_SELECTORS))
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r && r.width > 60 && r.height > 40;
        });
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function bounds(el) { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, width: r.width }; }
    // Cached platform rect (document coordinates) to avoid layout reads every frame during scroll
    let platCache = null; // { el, leftDoc, topDoc, width }
    let platRO = null;
    function measurePlatform(el) {
      try {
        const r = el.getBoundingClientRect();
        platCache = { el, leftDoc: r.left + window.scrollX, topDoc: r.top + window.scrollY, width: r.width };
      } catch { platCache = null; }
    }
    function observePlatform(el) {
      if (platRO) { try { platRO.disconnect(); } catch {} platRO = null; }
      try {
        platRO = new ResizeObserver(() => measurePlatform(el));
        platRO.observe(el);
      } catch {}
      window.addEventListener('resize', () => measurePlatform(el), { passive: true });
    }
    function boundsFor(el) {
      if (platCache && platCache.el === el) {
        const left = platCache.leftDoc - window.scrollX;
        const top = platCache.topDoc - window.scrollY;
        const right = left + platCache.width;
        return { left, top, right };
      }
      return bounds(el);
    }
    let currentEl = null; // platform element we are on
    let px = 0; // x offset from el.left
    let patrolTargetPx = null; // target x offset along platform
    let path = null; // jump/climb path {type,t,from:{el,x,y},to:{el,x,y},arc}
    const JUMP_SPEED = 0.012;
  // Action windows / effects
  let runUntilTs = 0;   // when > now, use run anim/speed multiplier
  let hurtUntil = 0;    // brief hurt period after hard land
  let ninjaUntil = 0;   // quick ninja pose after hurt
  let slideUntil = 0;   // slide animation window at edges
  // Tunables
  const GRAVITY_BASE = 0.25;
  const RUN_BOOST_MS = 2200;
  const HURT_MS = 450;
  const NINJA_EXTRA_MS = 350;
  const SLIDE_MS = 320;
  const EDGE_SLIDE_ZONE = 10;
  // Horizontal drift while falling (drag-release momentum)
  let varG_vx = 0;           // px per ms
  const DRAG = 0.0018;       // px/ms^2

    function sitOn(el, xPref = null) {
      currentEl = el; path = null; patrolTargetPx = null; state = 'idle';
      measurePlatform(el); observePlatform(el);
      const b = boundsFor(el);
      const minX = Math.max(8, b.left + MARGIN);
      const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
      const x = xPref == null ? (minX + maxX)/2 : clamp(xPref, minX, maxX);
      px = x - b.left; pos.x = x; pos.y = Math.round(b.top - PET_H);
    }
    function planPatrol() {
      if (!currentEl) return;
      const b = bounds(currentEl);
      const minX = Math.max(8, b.left + MARGIN);
      const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
      if (minX > maxX) return;
      const destX = Math.round(minX + Math.random() * Math.max(1, maxX - minX));
      patrolTargetPx = destX - b.left; state = 'walk';
    }
  function planJump(toEl) {
      if (!toEl || toEl === currentEl) return;
  const b1 = boundsFor(toEl);
  const b0 = currentEl ? boundsFor(currentEl) : null;
      const x0 = currentEl ? clamp(b0.left + px, b0.left + MARGIN, b0.right - MARGIN - PET_W) : Math.round(pos.x);
      const y0 = currentEl ? Math.round(b0.top - PET_H) : Math.round(pos.y);
      const minX1 = Math.max(8, b1.left + MARGIN);
      const maxX1 = Math.min(window.innerWidth - PET_W - 8, b1.right - MARGIN - PET_W);
      if (minX1 > maxX1) return;
      // land near the current horizontal position (nearest spot on target)
      const jitter = (Math.random() * 12) - 6; // -6..+6px to keep motion organic
      const x1 = Math.round(clamp(x0 + jitter, minX1, maxX1));
      const y1 = Math.round(b1.top - PET_H);
      path = { type: 'jump', t: 0, from: { el: currentEl, x: x0, y: y0 }, to: { el: toEl, x: x1, y: y1 }, arc: Math.max(24, Math.min(90, Math.abs(y1 - y0) + 30)) };
      state = 'jump';
    }
    function planClimb(toEl) {
      if (!currentEl || !toEl || toEl === currentEl) return;
      const b0 = boundsFor(currentEl), b1 = boundsFor(toEl);
      const leftGap = Math.abs(b0.left - b1.left);
      const rightGap = Math.abs(b0.right - b1.right);
      const side = leftGap < rightGap ? 'left' : 'right';
      // Anchor slightly outside the shared side to "hug" the wall while climbing
      const anchorX = side === 'left' ? (Math.max(b0.left, b1.left) - 8) : (Math.min(b0.right, b1.right) + 8);
      const x0 = anchorX, y0 = Math.round(b0.top - PET_H);
      const x1 = anchorX, y1 = Math.round(b1.top - PET_H);
      path = { type: 'climb', t: 0, side, dir: (side === 'left' ? -1 : 1), from: { el: currentEl, x: x0, y: y0 }, to: { el: toEl, x: x1, y: y1 }, arc: 0 };
      state = 'climb';
    }
    function pickParkour() {
  const others = collectPlatformEls().filter(el => el !== currentEl);
      if (!others.length) return planPatrol();
      const curRef = (() => {
        if (currentEl) {
          const b = boundsFor(currentEl);
          return { x: clamp(b.left + px, b.left + MARGIN, b.right - MARGIN - PET_W), y: Math.round(b.top - PET_H), b };
        }
        return { x: pos.x, y: pos.y, b: { left: pos.x - PET_W/2, right: pos.x + PET_W/2, top: pos.y + PET_H } };
      })();
      // find nearest platform by euclidean distance to its top center
      let choice = null;
      let bestD = Infinity;
      for (const el of others) {
        const b = boundsFor(el);
        const cx = (b.left + b.right) / 2;
        const dx = Math.abs(cx - curRef.x);
        const dy = Math.abs(b.top - curRef.y);
        const d = Math.hypot(dx, dy * 1.05); // slight weight to vertical
        // hard cap on reach: avoid far-away targets
        const MAX_REACH = Math.max(120, window.innerWidth * 0.18);
        if (d < bestD && d <= MAX_REACH) { bestD = d; choice = el; }
      }
      if (!choice) return planPatrol();
      const b0 = curRef.b; const b1 = bounds(choice);
      const vertical = Math.abs(b1.top - b0.top) > 40;
      const overlap = !(b1.right < b0.left || b1.left > b0.right);
      if (vertical && overlap) planClimb(choice); else planJump(choice);
    }
    // Occasionally, step beyond the edge to demo falling
    function teaseEdgeFall() {
      if (!currentEl) return;
      const b = bounds(currentEl);
      const minX = Math.max(8, b.left + MARGIN);
      const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
      // choose just outside either edge
      const toLeft = Math.random() < 0.5;
      const dest = toLeft ? (minX - 6) : (maxX + 6);
      patrolTargetPx = dest - b.left; state = 'walk';
    }
    function chooseHideSpot() {
      const plats = collectPlatformEls();
      if (!plats.length) return false;
      const p = plats[Math.floor(Math.random() * plats.length)];
      const PET_W = 48, PET_H = 48;
      const side = Math.random() < 0.5 ? 'left' : 'right';
      const x = side === 'left' ? (p.left - 12) : (p.right + 12);
      const y = p.top - PET_H + 8; // peek over
      target.x = clamp(x, 8, window.innerWidth - PET_W - 8);
      target.y = clamp(y, 8, window.innerHeight - PET_H - 8);
      state = 'hide'; resetIdle();
      return true;
    }
    function maybeChaseCursor() {
      if (false && Math.random() < CURSOR_PLAY_PROB) {
  const plats = collectPlatformEls();
        const PET_W = 48, PET_H = 48;
        let chosen = null;
        if (plats.length) {
          chosen = plats.reduce((best, p) => {
            const d = Math.abs(p.top - mouse.y);
            return (!best || d < best.d) ? { p, d } : best;
          }, null)?.p || null;
        }
        if (chosen) {
          target.x = clamp(mouse.x - PET_W/2, chosen.left + 8, chosen.right - PET_W - 8);
          target.y = Math.round(chosen.top - PET_H);
        } else {
          target.x = Math.round(mouse.x - PET_W/2);
          target.y = Math.round(mouse.y - PET_H/2);
        }
  state = 'chase'; resetIdle();
  setTimeout(() => { if (state === 'chase') { const els = collectPlatformEls(); if (els.length) sitOn(els[0]); state = 'idle'; } }, 2200);
      }
    }
    function maybeSleep() {
      const IDLE_LIMIT = safeMode ? 14000 : 10000;
      if (Date.now() - idleSince > IDLE_LIMIT && state !== 'sleep') {
        state = 'sleep';
        // stay where you are; show zzz a few times
        emote('zzz'); setTimeout(()=>emote('zzz'), 900);
      }
    }
    function wakeUp() {
      if (state === 'sleep') { state = 'idle'; resetIdle(); setSprite('idle'); }
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // gravity vertical velocity (used in falling)
  let varG_vy = 0;
  // delta-time accumulator for consistent physics
  let __lastTickTs = performance.now();

    function tick() {
      const nowTs = performance.now();
      let dtMs = nowTs - __lastTickTs;
      // Clamp to avoid huge catch-up steps on tab refocus
      if (!Number.isFinite(dtMs) || dtMs <= 0) dtMs = 16;
      dtMs = Math.max(8, Math.min(50, dtMs));
      __lastTickTs = nowTs;
      const dtScale = dtMs / 16.6667; // relative to 60fps
      const speedBase = SPEED * (safeMode ? 0.8 : 1) * dtScale;
      pet.style.opacity = petHidden ? '0' : '1';

      // Update anchored position when idle/patrol
      if (currentEl && (state === 'idle' || state === 'walk' || state === 'sleep')) {
        const b = boundsFor(currentEl);
        const minX = Math.max(8, b.left + MARGIN);
        const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
        const x = clamp(b.left + px, minX, maxX);
        pos.x = x; pos.y = Math.round(b.top - PET_H);
      }

      // Patrol along platform
      if (state === 'walk' && currentEl && patrolTargetPx != null) {
        const b = boundsFor(currentEl);
        const curX = b.left + px; const destX = b.left + patrolTargetPx;
        const dx = destX - curX;
  const speed = speedBase * (Date.now() < runUntilTs ? 1.6 : 1);
        const step = Math.sign(dx) * Math.min(Math.abs(dx), speed);
        px += step; facing = step < 0 ? -1 : 1;
        const minX = Math.max(8, b.left + MARGIN);
        const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
        const absX = b.left + px;
        const nearLeft = (absX - minX) <= EDGE_SLIDE_ZONE && step < 0;
        const nearRight = (maxX - absX) <= EDGE_SLIDE_ZONE && step > 0;
        if ((nearLeft || nearRight) && Date.now() < runUntilTs) {
          // trigger a short edge slide; clamp to the edge
          const edgeX = nearLeft ? minX : maxX;
          px = edgeX - b.left; pos.x = edgeX; pos.y = Math.round(b.top - PET_H);
          state = 'slide'; slideUntil = Date.now() + SLIDE_MS; patrolTargetPx = null;
        } else {
        // If we walked past the platform, fall
        if (absX < minX || absX > maxX) {
          currentEl = null; patrolTargetPx = null; state = 'fall';
          pos.x = absX; varG_vy = 0;
        } else {
          if (Math.abs(dx) <= 1) { patrolTargetPx = null; state = 'idle'; resetIdle(); }
          pos.x = clamp(absX, minX, maxX); pos.y = Math.round(b.top - PET_H);
        }
        }
      }

      // Slide at edge
    if (state === 'slide') {
        // small drift beyond edge then fall, or stop after time
  const drift = 0.8 * dtScale;
  pos.x += facing * drift;
        if (currentEl) {
      const b = boundsFor(currentEl);
          const minX = Math.max(8, b.left + MARGIN);
          const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
          if (pos.x < minX || pos.x > maxX) {
            currentEl = null; state = 'fall'; varG_vy = 0;
          } else {
            pos.y = Math.round(b.top - PET_H);
            if (Date.now() >= slideUntil) { state = 'idle'; resetIdle(); }
          }
        }
      }

      // Gravity fall when not on a platform
      if (state === 'fall') {
  // vertical velocity (integrate with dt)
  varG_vy += GRAVITY_BASE * (safeMode ? 0.7 : 1) * dtScale; // a*dt
  pos.y += varG_vy * dtScale; // v*dt
  // horizontal drift with simple drag
  if (varG_vx !== 0) {
    pos.x += varG_vx * dtMs;
    const s = Math.sign(varG_vx);
    varG_vx -= s * DRAG * dtMs;
    if (Math.sign(varG_vx) !== s) varG_vx = 0;
    // keep inside viewport bounds
    const minX = 4;
    const maxX = Math.min(window.innerWidth - PET_W - 8, window.innerWidth - 52);
    if (pos.x < minX) { pos.x = minX; varG_vx = 0; }
    if (pos.x > maxX) { pos.x = maxX; varG_vx = 0; }
  }
        // Try to catch a platform directly below
        let catchPlat = null;
        let catchY = Infinity;
        const plats = collectPlatformEls();
        for (const el of plats) {
          const b = boundsFor(el);
          const minX = Math.max(8, b.left + MARGIN);
          const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
          const top = Math.round(b.top - PET_H);
          if (pos.x >= minX && pos.x <= maxX && top >= pos.y && top < catchY) {
            catchY = top; catchPlat = el;
          }
        }
        const groundTop = Math.round((window.innerHeight - 6) - PET_H);
        if (catchPlat && pos.y >= catchY) {
          sitOn(catchPlat, pos.x); pos.y = catchY; varG_vy = 0; varG_vx = 0; state = 'hurt';
          hurtUntil = Date.now() + HURT_MS; ninjaUntil = hurtUntil + NINJA_EXTRA_MS; emote('star');
        } else if (pos.y >= groundTop) {
          pos.y = groundTop; varG_vy = 0; varG_vx = 0; state = 'hurt';
          hurtUntil = Date.now() + HURT_MS; ninjaUntil = hurtUntil + NINJA_EXTRA_MS; emote('star');
          setTimeout(() => { if (state === 'idle') { const els = collectPlatformEls(); if (els.length) planJump(els[0]); } }, 900);
        }
      }

      // Jump/climb/mantle interpolation
      if (path && (state === 'jump' || state === 'climb' || state === 'mantle')) {
        path.t = Math.min(1, path.t + JUMP_SPEED * (safeMode ? 0.7 : 1) * dtScale);
        const t = path.t; const x = path.from.x + (path.to.x - path.from.x) * t;
        let y = path.from.y + (path.to.y - path.from.y) * t;
        if (state === 'jump' || state === 'mantle') { y -= (path.arc || 0) * Math.sin(Math.PI * t); }
        pos.x = x; pos.y = y;
        if (state === 'climb' && path.dir) { facing = path.dir; } else { facing = (path.to.x - path.from.x) < 0 ? -1 : 1; }
        if (t >= 1) {
          if (state === 'climb') {
            // Quick mantle onto the top surface, slightly inside the platform edge
            const b = boundsFor(path.to.el);
            const minX = Math.max(8, b.left + MARGIN);
            const maxX = Math.min(window.innerWidth - PET_W - 8, b.right - MARGIN - PET_W);
            const insideX = (path.side === 'left') ? (minX + 6) : (maxX - 6);
            const topY = Math.round(b.top - PET_H);
            path = { type: 'mantle', t: 0, from: { el: null, x: pos.x, y: pos.y }, to: { el: path.to.el, x: insideX, y: topY }, arc: 12 };
            state = 'mantle';
          } else {
            sitOn(path.to.el, path.to.x); state = 'idle'; resetIdle(); path = null;
          }
        }
      }

      // Recover from hurt -> ninja -> idle
  if (state === 'hurt') {
        if (Date.now() >= hurtUntil) {
          state = 'idle'; resetIdle();
        }
      }

      // Sprite
  frameTimer += dtMs; let mode = 'idle';
  if (state === 'walk') mode = (Date.now() < runUntilTs ? 'run' : 'walk');
  if (state === 'jump') mode = 'jump';
  if (state === 'mantle') mode = 'jump';
  if (state === 'climb') mode = 'climb';
  if (state === 'fall') mode = 'fall';
  if (state === 'hurt') mode = 'hurt';
  if (state === 'slide') mode = 'slide';
  if (Date.now() < ninjaUntil) mode = 'ninja';
  if (state === 'sleep') mode = 'sleep';
  const period = mode === 'run' ? 120 : mode === 'walk' ? 180 : mode === 'sleep' ? 700 : 520;
      if (frameTimer >= period) { frameTimer = 0; frameIndex = (frameIndex + 1) % (SPRITES[mode]?.length || 1); }
      setSprite(mode);
      const flip = facing < 0 ? -1 : 1;
      pet.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) scaleX(${flip})`;

      // Occasional decisions
      if (state === 'idle' && Math.random() < 0.012) { Math.random() < 0.65 ? planPatrol() : pickParkour(); }
      if (state === 'idle') maybeSleep();

      requestAnimationFrame(tick);
    }
    // Initialize
    const startEls = collectPlatformEls();
    if (startEls.length) { sitOn(startEls[0]); } // pick first eligible; will patrol subsequently
    requestAnimationFrame(tick);

  // Widget interactions still give XP
  widget.addEventListener('click', () => gain(2));
  widget.addEventListener('mouseenter', () => gain(1));
    // Exploration hooks
    const orig = window.setActiveTab; window.setActiveTab = function() { try { gain(1); } catch {} return orig.apply(this, arguments); };
    document.querySelectorAll('a[href$=".html"]').forEach(a => a.addEventListener('click', () => gain(2), { once: true }));
    render();
    // When active profile changes, reload namespaced pet state
  window.addEventListener('profile:changed', () => {
      try {
    // If user had legacy global pet data, copy it into their namespaced keys now
    if (typeof migrateLegacyPet === 'function') migrateLegacyPet();
        level = parseInt(localStorage.getItem(petKey(LV_KEY)) || '1', 10) || 1;
        xp = parseInt(localStorage.getItem(petKey(XP_KEY)) || '0', 10) || 0;
        petName = (localStorage.getItem(petKey(NAME_KEY)) || 'Buddy').trim().slice(0, 24) || 'Buddy';
        nameEl.textContent = petName;
        petHidden = (localStorage.getItem(petKey(HIDE_KEY)) === '1');
        pet.style.opacity = petHidden ? '0' : '1';
        resetIfNewDay();
        refreshLimitsUI();
        render();
      } catch {}
    });
  });
})();

// Build tiny PNG sprite frames via canvas and return data URLs
function buildSprites() {
  function makeFrame(draw) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d');
    // transparent baseline
    x.clearRect(0,0,16,16);
    draw(x);
    return c.toDataURL('image/png');
  }
  // simple body color palette
  const BODY = '#222';
  const ACC = '#7f5af0';
  const EYE = '#fff';
  const frames = {
    idle: [], walk: [], run: [], jump: [], climb: [], fall: [], hurt: [], ninja: [], slide: [], sleep: []
  };
  // idle frames (bob)
  frames.idle.push(makeFrame((ctx)=>{
    drawPet(ctx, 0); // neutral
  }));
  frames.idle.push(makeFrame((ctx)=>{
    drawPet(ctx, 1); // bob up
  }));
  // walk frames (legs alternate)
  frames.walk.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'walkA'); }));
  frames.walk.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'walkB'); }));
  // run frames (faster leg cycle)
  frames.run.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'runA'); }));
  frames.run.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'runB'); }));
  // jump (mid-air pose)
  frames.jump.push(makeFrame((ctx)=>{ drawPet(ctx, 1, 'jump'); }));
  // climb (hanging sideways)
  frames.climb.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'climbA'); }));
  frames.climb.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'climbB'); }));
  // fall (feet tucked)
  frames.fall.push(makeFrame((ctx)=>{ drawPet(ctx, -1, 'fall'); }));
  // hurt (blink red scarf accent)
  frames.hurt.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'hurt'); }));
  // ninja pose (crouch)
  frames.ninja.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'ninja'); }));
  // slide pose
  frames.slide.push(makeFrame((ctx)=>{ drawPet(ctx, 0, 'slide'); }));
  // sleep frames
  frames.sleep.push(makeFrame((ctx)=>{ drawPet(ctx, 2, 'sleep'); }));
  frames.sleep.push(makeFrame((ctx)=>{ drawPet(ctx, 2, 'sleepBlink'); }));

  function drawPet(ctx, bob=0, mode='idle') {
    // base body rectangle with tiny legs; simple pixel art feel
    const yOff = bob; // bob offset
    ctx.fillStyle = BODY;
    // body (alter shapes for modes)
    if (mode === 'ninja') {
      ctx.fillRect(4, 8 - yOff, 8, 4);
    } else if (mode === 'fall') {
      ctx.fillRect(4, 7 - yOff, 8, 5);
    } else if (mode === 'slide') {
      ctx.fillRect(5, 8 - yOff, 7, 4);
    } else {
      ctx.fillRect(4, 6 - yOff, 8, 6);
    }
    // ears
    ctx.fillRect(4, 4 - yOff, 2, 2);
    ctx.fillRect(10, 4 - yOff, 2, 2);
    // face
    ctx.fillStyle = EYE;
    if (mode === 'sleep' || mode === 'sleepBlink' || mode === 'hurt') {
      // closed eyes
      ctx.fillRect(6, 8 - yOff, 2, 1);
      ctx.fillRect(9, 8 - yOff, 2, 1);
    } else {
      ctx.fillRect(6, 8 - yOff, 1, 1);
      ctx.fillRect(10, 8 - yOff, 1, 1);
    }
    // accent scarf
    ctx.fillStyle = (mode === 'hurt') ? '#ef4565' : ACC; ctx.fillRect(4, 11 - yOff, 8, 1);
    // legs
    ctx.fillStyle = BODY;
    if (mode === 'walkA') {
      ctx.fillRect(5, 12 - yOff, 2, 2);
      ctx.fillRect(9, 12 - yOff, 1, 1);
    } else if (mode === 'walkB') {
      ctx.fillRect(5, 12 - yOff, 1, 1);
      ctx.fillRect(9, 12 - yOff, 2, 2);
    } else if (mode === 'runA') {
      ctx.fillRect(5, 12 - yOff, 2, 1);
      ctx.fillRect(9, 11 - yOff, 2, 2);
    } else if (mode === 'runB') {
      ctx.fillRect(5, 11 - yOff, 2, 2);
      ctx.fillRect(9, 12 - yOff, 2, 1);
    } else if (mode === 'jump') {
      ctx.fillRect(6, 12 - yOff, 1, 1);
      ctx.fillRect(9, 11 - yOff, 1, 1);
    } else if (mode === 'climbA') {
      ctx.fillRect(5, 12 - yOff, 1, 2);
      ctx.fillRect(10, 10 - yOff, 1, 2);
    } else if (mode === 'climbB') {
      ctx.fillRect(6, 11 - yOff, 1, 2);
      ctx.fillRect(9, 12 - yOff, 1, 2);
    } else if (mode === 'fall') {
      ctx.fillRect(6, 12 - yOff, 1, 1);
      ctx.fillRect(9, 12 - yOff, 1, 1);
    } else if (mode === 'ninja') {
      ctx.fillRect(6, 11 - yOff, 2, 1);
    } else if (mode === 'slide') {
      ctx.fillRect(6, 12 - yOff, 2, 1);
    } else {
      ctx.fillRect(6, 12 - yOff, 1, 1);
      ctx.fillRect(9, 12 - yOff, 1, 1);
    }
    // sleep blink variation
    if (mode === 'sleepBlink') {
      ctx.clearRect(6, 8 - yOff, 2, 1);
      ctx.clearRect(9, 8 - yOff, 2, 1);
    }
  }
  return frames;
}

// Build tiny pixel emote sprites (heart, star, arrow) as data URLs
function buildEmotes() {
  function make(draw) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const ctx = c.getContext('2d');
    ctx.clearRect(0,0,16,16); draw(ctx); return c.toDataURL('image/png');
  }
  const HEART = make((g)=>{
    // darker outline + bright fill
    const O = '#a51733', F = '#ff2e63', H = '#ff6b8a';
    const out = [[6,2],[9,2],[5,3],[10,3],[4,4],[11,4],[4,5],[11,5],[5,6],[10,6],[6,7],[9,7],[7,8],[8,8]];
    const fill = [[6,3],[7,3],[8,3],[9,3],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[6,6],[7,6],[8,6],[9,6],[7,7],[8,7]];
    g.fillStyle = O; out.forEach(([x,y])=>g.fillRect(x,y,1,1));
    g.fillStyle = F; fill.forEach(([x,y])=>g.fillRect(x,y,1,1));
    // highlight
    g.fillStyle = H; g.fillRect(7,4,1,1); g.fillRect(8,4,1,1);
  });
  const STAR = make((g)=>{
    const O = '#c19700', F = '#ffd400', H = '#fff0a6';
    const out = [[8,1],[7,3],[8,3],[9,3],[5,5],[7,5],[9,5],[11,5],[6,6],[8,6],[10,6],[8,9]];
    const fill = [[8,2],[6,4],[7,4],[8,4],[9,4],[10,4],[4,6],[5,6],[6,5],[7,6],[8,5],[9,6],[10,5],[11,6],[12,6],[6,7],[7,7],[8,7],[9,7],[10,7],[8,8]];
    g.fillStyle = O; out.forEach(([x,y])=>g.fillRect(x,y,1,1));
    g.fillStyle = F; fill.forEach(([x,y])=>g.fillRect(x,y,1,1));
    g.fillStyle = H; g.fillRect(8,4,1,1); g.fillRect(7,6,1,1);
  });
  const ARROW = make((g)=>{
    // green arrow with outline and inner highlight
    const O = '#167a54', F = '#2cb67d', H = '#8fe3b5';
    const out = [[8,2],[7,3],[8,3],[9,3],[6,4],[7,4],[8,4],[9,4],[10,4],[7,7],[8,7],[9,7]];
    const fill = [[8,2],[7,4],[8,4],[9,4],[6,5],[7,5],[8,5],[9,5],[10,5],[8,6]];
    g.fillStyle = O; out.forEach(([x,y])=>g.fillRect(x,y,1,1));
    g.fillStyle = F; fill.forEach(([x,y])=>g.fillRect(x,y,1,1));
    g.fillStyle = H; g.fillRect(8,4,1,1);
  });
  const HAPPY = make((g)=>{
    // yellow smiley
    const O = '#8a6a00', F = '#ffd54a', K = '#1b1b1b';
    g.fillStyle = O; g.fillRect(5,3,6,1); g.fillRect(4,4,1,6); g.fillRect(11,4,1,6); g.fillRect(5,10,6,1);
    g.fillStyle = F; g.fillRect(5,4,6,6);
    g.fillStyle = K; g.fillRect(7,6,1,1); g.fillRect(9,6,1,1); // eyes
    g.fillRect(7,8,3,1); g.fillRect(8,9,1,1); // smile
  });
  const ANGRY = make((g)=>{
    // red angry
    const O = '#7a1020', F = '#ef4565', K = '#1b1b1b';
    g.fillStyle = O; g.fillRect(5,3,6,1); g.fillRect(4,4,1,6); g.fillRect(11,4,1,6); g.fillRect(5,10,6,1);
    g.fillStyle = F; g.fillRect(5,4,6,6);
    g.fillStyle = K; g.fillRect(6,6,2,1); g.fillRect(9,6,2,1); // brows
    g.fillRect(7,7,1,1); g.fillRect(10,7,1,1); // eyes
    g.fillRect(7,9,3,1); // frown
  });
  const ZZZ = make((g)=>{
    // tiny pixel 'Zz' with outline
    const O = '#213547', F = '#cde3ff';
    // Big Z
    g.fillStyle = O; g.fillRect(2,3,5,1); g.fillRect(2,4,1,2); g.fillRect(6,4,1,2); g.fillRect(2,6,5,1);
    g.fillStyle = F; g.fillRect(3,4,3,1); g.fillRect(5,5,1,1); g.fillRect(3,6,3,1);
    // small z
    g.fillStyle = O; g.fillRect(9,6,3,1); g.fillRect(9,7,1,1); g.fillRect(11,7,1,1); g.fillRect(9,8,3,1);
    g.fillStyle = F; g.fillRect(10,7,1,1);
  });
  return { heart: HEART, star: STAR, arrow: ARROW, happy: HAPPY, angry: ANGRY, zzz: ZZZ };
}
