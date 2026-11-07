/* আমার প্রস্তুতি — অফলাইন সার্ভিস ওয়ার্কার
   ফাইল বদলালে/যোগ করলে নিচের CACHE নামের সংখ্যা বাড়িয়ে দিন (যেমন v1 → v2)। */
const CACHE = 'prostuti-v1';
const FILES = [
  './', 'index.html', 'vocab.html', 'international.html', 'bangladesh.html', 'idioms.html',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'
];
/* পেজগুলোর <link>-এর সাথে হুবহু এক হতে হবে */
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* একটি ফাইল না পেলেও বাকিগুলো জমা হবে */
    await Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {})));
    /* ফন্ট: CSS আর তার ভেতরের সব ফন্ট ফাইল আগেভাগে জমা রাখা (অনলাইনে থাকলে) */
    try {
      const r = await fetch(FONT_CSS, { mode: 'cors', cache: 'reload' });
      if (r.ok) {
        const css = await r.clone().text();
        await c.put(FONT_CSS, r);
        const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)\s'"]+)\)/g)].map(m => m[1]))];
        await Promise.all(urls.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
      }
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* ফন্ট: আগে জমা থেকে, না থাকলে নেট থেকে এনে জমা রাখা */
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      } catch (_) { return new Response('', { status: 504 }); }
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  /* নিজের ফাইল: জমা থেকে সাথে সাথে দেখানো, পেছনে নতুন সংস্করণ এনে রাখা */
  let done; e.waitUntil(new Promise(r => (done = r)));
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null).finally(() => done());
    if (hit) return hit;
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') { const home = await c.match('index.html'); if (home) return home; }
    return Response.error();
  })());
});
