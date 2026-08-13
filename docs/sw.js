/* Service worker: makes the app open instantly and still work with no signal.

   Two strategies, on purpose:
   - The shell (HTML/CSS/JS/icons) is cache-first. It changes only when we ship,
     and SHELL_VERSION below is what ships it.
   - Content (data/*.json, files/*.pdf) is network-first with a cache fallback,
     so a person online always sees this week's message, and a person on the
     subway still sees last week's.

   Bump SHELL_VERSION whenever index.html, app.css, or app.js changes —
   `python3 tools/build.py` does it for you. */

const SHELL_VERSION = "v04d7083f";
const SHELL = `gcb-shell-${SHELL_VERSION}`;
const CONTENT = "gcb-content-v1";

const SHELL_FILES = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "install.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll fails the whole install if any one file 404s; add them
      // individually so a missing optional asset can't break the app.
      .then((c) => Promise.all(SHELL_FILES.map((f) => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== CONTENT).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Leave YouTube embeds and thumbnails to the browser's own HTTP cache —
  // storing opaque cross-origin responses here would burn quota blindly.
  if (url.origin !== location.origin) return;

  const isContent = url.pathname.includes("/data/") || url.pathname.includes("/files/");

  if (isContent) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CONTENT).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).catch(() =>
      // A navigation that misses the cache offline still gets the app shell;
      // the hash router takes it from there.
      req.mode === "navigate" ? caches.match("index.html") : Response.error()
    ))
  );
});
