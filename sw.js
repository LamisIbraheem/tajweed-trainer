// Tajweed Trainer service worker: lets the site install as an app and work offline.
//
// - Pages: network first (so updates arrive as soon as the app is opened online), falling back to the
//   saved copy when offline or when the network takes longer than 4 s.
// - Site files (css/js with ?v=…, icons): cache first; a new ?v= in index.html means new files are fetched.
// - Recitation audio (everyayah mirror): served from the phone once saved. A clip is saved the first time
//   it is played, or all at once with "Download all audio" on the Progress page. Audio is answered with
//   byte ranges, which is what <audio> needs to seek to a clip.
//
// Bump SW_VERSION whenever this file's logic changes (site content updates don't need it).
const SW_VERSION = "2026-11-25";
const SHELL = "tajweed-shell";
const AUDIO = "tajweed-audio";
const FONTS = "tajweed-fonts";
const AUDIO_HOST = "mirrors.quranicaudio.com";
const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const res = await fetch("./", { cache: "reload" });
    if (res.ok) await saveShell(res);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (![SHELL, AUDIO, FONTS].includes(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

// Save index.html and every local file it references (scripts, styles, icons, manifest),
// and drop saved files from older versions that the page no longer uses.
async function saveShell(res) {
  const html = await res.clone().text();
  const cache = await caches.open(SHELL);
  await cache.put("./", res);
  const local = new Set(["manifest.webmanifest", "img/icon-192.png", "img/icon-512.png", "img/icon-maskable-512.png"]);
  for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) local.add(m[1]);
  const wanted = new Set([...local].map(u => new URL(u, self.registration.scope).href));
  await Promise.all([...wanted].map(async u => {
    if (await cache.match(u)) return;
    try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch (e) { /* offline: try next time */ }
  }));
  const index = new URL("./", self.registration.scope).href;
  for (const req of await cache.keys()) if (req.url !== index && !wanted.has(req.url)) await cache.delete(req);
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && url.origin === location.origin) return event.respondWith(page(event));
  if (url.origin === location.origin) return event.respondWith(sameOrigin(req));
  if (url.hostname === AUDIO_HOST) return event.respondWith(audio(event, url));
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return event.respondWith(fonts(event));
  // Anything else (e.g. the visitor counter) goes straight to the network.
});

function page(event) {
  // Keep the worker alive until the fresh page is saved, even if the saved copy answered first.
  let saving = null;
  const network = fetch(event.request).then(res => {
    if (res.ok) saving = saveShell(res.clone());
    return res;
  });
  event.waitUntil(network.then(() => saving).catch(() => {}));
  return (async () => {
    const timeout = new Promise(resolve => setTimeout(resolve, NAV_TIMEOUT_MS));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch (e) { /* offline */ }
    const saved = await (await caches.open(SHELL)).match("./");
    return saved || network;
  })();
}

async function sameOrigin(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function fonts(event) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request).then(res => { cache.put(event.request, res.clone()); return res; }).catch(() => hit);
  if (hit) { event.waitUntil(refresh); return hit; }
  return refresh;
}

async function audio(event, url) {
  const key = url.origin + url.pathname;          // one saved copy per ayah file
  const cache = await caches.open(AUDIO);
  const download = url.searchParams.has("dl");     // "Download all audio" on the Progress page
  let hit = await cache.match(key);
  if (!hit && download) {
    const res = await fetch(key, { mode: "cors" });
    if (res.ok) { await cache.put(key, res.clone()); return new Response(null, { status: 204 }); }
    return res;
  }
  if (download) return new Response(null, { status: 204 });
  if (hit) return withRange(hit, event.request.headers.get("range"));
  // Not saved yet: play from the network now, and save the whole file for next time.
  event.waitUntil(fetch(key, { mode: "cors" }).then(res => res.ok && cache.put(key, res)).catch(() => {}));
  return fetch(event.request);
}

// Answer a (possibly partial) audio request from a saved file.
async function withRange(saved, range) {
  const blob = await saved.blob();
  const size = blob.size, type = saved.headers.get("Content-Type") || "audio/mpeg";
  const m = /bytes=(\d*)-(\d*)/.exec(range || "");
  if (!m) return new Response(blob, { status: 200, headers: { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "X-Tajweed-Offline": "1" } });
  let start = m[1] === "" ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (!(start >= 0 && start <= end)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: { "Content-Type": type, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "X-Tajweed-Offline": "1" }
  });
}
