const VERSION = "bib-v16";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-maskable-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./books.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (cache, request, response) =>
  cache.put(request, response.clone()).catch(() => {});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // navegação (sempre funcionar offline)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          caches.open(VERSION).then((c) => put(c, "./index.html", r));
          return r;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // catálogo: rede primeiro, cache como fallback
  if (url.pathname.endsWith("/books.json")) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          caches.open(VERSION).then((c) => put(c, e.request, r));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // recursos do app: cache com atualização silenciosa
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((r) => {
        const fallback = r || fetch(e.request).then((res) => {
          caches.open(VERSION).then((c) => put(c, e.request, res));
          return res;
        });
        return fallback;
      })
    );
    return;
  }

  // capas externas: cache-first (funciona offline)
  if (url.hostname.includes("openlibrary.org") || url.hostname.includes("books.google.com")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok || res.type === "opaque") caches.open(VERSION).then((c) => put(c, e.request, res));
          return res;
        }).catch(() => cached);
      })
    );
  }
});

self.addEventListener("message", (e) => {
  const d = e.data;
  if (!d) return;
  if (d.type === "notify") {
    self.registration.showNotification(d.title || "Minha Biblioteca", {
      body: d.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: d.tag || "bib",
    });
  }
  if (d.type === "schedule" && typeof NotificationTrigger !== "undefined") {
    self.registration.showNotification(d.title || "Hora de ler! 📖", {
      body: d.body || "Quanto você leu hoje?",
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "diario-" + d.time,
      showTrigger: new NotificationTrigger({ time: d.time }),
    });
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});