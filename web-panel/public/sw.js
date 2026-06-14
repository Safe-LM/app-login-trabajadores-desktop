// Service worker para Safe Link.
// Soporta notificaciones nativas y caché para soporte PWA sin conexión.
//
// ⚠️ IMPORTANTE: Los chunks compilados de Next.js (/_next/) NO se cachean.
// Cada compilación genera nuevos hashes. Cachearlos provoca que el navegador
// sirva bundles desactualizados → errores de hidratación al recargar la página.

const CACHE_NAME = "safelink-cache-v4";

// Solo assets estáticos de la PWA (tamaño pequeño, raramente cambian)
const STATIC_ASSETS = [
  "/icon.svg",
  "/apple-icon.svg",
  "/manifest.webmanifest",
];

// ── Install: pre-cachear assets estáticos ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Activa de inmediato sin esperar que se cierren las pestañas viejas
  self.skipWaiting();
});

// ── Activate: eliminar TODOS los cachés anteriores ─────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia diferenciada ─────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // ❌ NUNCA cachear chunks de Next.js: cambian en cada compilación.
  //    Dejarlos pasar directo a la red garantiza que siempre se cargue
  //    el bundle correcto y no haya mismatch de hidratación.
  if (url.pathname.startsWith("/_next/")) return;

  // ✅ Cache-first solo para assets estáticos de la PWA
  if (url.origin === self.origin && STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) return response;
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, response.clone())
          );
          return response;
        });
      })
    );
  }

  // Para todo lo demás (páginas HTML, APIs de la app): red directa, sin caché.
});

// ── Push Notifications ──────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notificaciones";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.endsWith(url) && "focus" in w) return w.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
