// JourneyAI service worker: offline app shell + map tiles, and Web Push reminders.
// Strategy: network-first for the app (always fresh when online), cache fallback offline.
const APP_CACHE = "journeyai-app-v1";
const RUNTIME_CACHE = "journeyai-runtime-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];
const RUNTIME_HOSTS = ["tile.openstreetmap.org", "fonts.googleapis.com", "fonts.gstatic.com"];
const RUNTIME_MAX = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // API calls always go to the network; the app keeps its own data locally.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? caches.match("/") : Response.error())),
    );
    return;
  }

  // Map tiles and fonts: cache-first, refreshed in the background.
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok || res.type === "opaque") {
              cache.put(request, res.clone());
              trim(RUNTIME_CACHE, RUNTIME_MAX);
            }
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "JourneyAI", body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "JourneyAI", {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag,
      data: { url: data.url || "/#alerts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) return win.focus().then(() => win.navigate(target));
      return self.clients.openWindow(target);
    }),
  );
});
