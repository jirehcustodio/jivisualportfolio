const CACHE = 'portfolio-v7';
const CORE = [
  './index.html',
  './style.css',
  './script.js',
  './offline.html',
  './SmartHomeAutomationLogo.png',
  './resume%20analyzer%20logo.png',
  './websitelogo.png',
  './robots.txt',
  './sitemap.xml',
  './demo-portfolio-site.html',
  './demo-resume-analyzer.html',
  './demo-smart-home.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE) ? caches.delete(k) : Promise.resolve()));
  try { if (self.registration.navigationPreload) await self.registration.navigationPreload.enable(); } catch {}
  await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith((async () => {
    const url = new URL(request.url);
    const cache = await caches.open(CACHE);
    // HTML: network-first with offline fallback
    if (request.headers.get('accept')?.includes('text/html')) {
      try {
        const fresh = await fetch(request);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match(request);
        return cached || caches.match('./offline.html');
      }
    }
    // Others: stale-while-revalidate; add short-lived Cache-Control for images
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then(resp => {
      const isImage = resp.headers.get('content-type')?.startsWith('image/');
      if (isImage) {
        const headers = new Headers(resp.headers);
        headers.set('Cache-Control', 'public, max-age=86400');
        const wrapped = new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
        cache.put(request, wrapped.clone());
        return wrapped;
      }
      cache.put(request, resp.clone());
      return resp;
    }).catch(() => undefined);
    return cached || fetchPromise || new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});

// ---- Background Sync: Intake queue ----
// Minimal IndexedDB helpers inside SW
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('portfolio-queue', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('intakes')) {
        db.createObjectStore('intakes', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(item) {
  return openQueueDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('intakes', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('intakes').put(item);
  }));
}
function idbGetAll() {
  return openQueueDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('intakes', 'readonly');
    const store = tx.objectStore('intakes');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}
function idbDelete(id) {
  return openQueueDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('intakes', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('intakes').delete(id);
  }));
}

async function tryPostIntake(payload) {
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  const origin = self.location.origin || '';
  const candidates = [];
  if (origin && /^https?:/i.test(origin)) {
    candidates.push(origin.replace(/\/$/, '') + '/.netlify/functions/intake');
    candidates.push(origin.replace(/\/$/, '') + '/api/intake');
  }
  candidates.push('http://localhost:3001/intake', 'http://localhost:3002/intake');
  for (const url of candidates) {
    try { const r = await fetch(url, opts); if (r.ok) return true; } catch {}
  }
  return false;
}

async function drainIntakeQueue() {
  const items = await idbGetAll();
  for (const item of items) {
    const ok = await tryPostIntake(item.payload);
    if (ok) await idbDelete(item.id);
  }
}

// Receive enqueue requests from the page
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'ENQUEUE_INTAKE' && data.payload) {
    const id = Date.now() + '-' + Math.random().toString(36).slice(2);
    event.waitUntil(idbPut({ id, payload: data.payload }).then(async () => {
      if (self.registration && 'sync' in self.registration) {
        try { await self.registration.sync.register('intake-sync'); } catch {}
      }
    }));
  }
});

// Background Sync handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'intake-sync') {
    event.waitUntil(drainIntakeQueue());
  }
});
