// Service worker: push notifications, and keeping the site's own files so it
// opens with no connection (offline mode). Registered from src/main.tsx.
//
// Only this site's pages and its built files (assets/, named by content hash)
// are kept; requests to Convex, Google or anywhere else are never touched, and
// the trip data itself is kept by the page (src/lib/offline.ts). A page is
// fetched fresh whenever there is a network, so a deploy shows up at once.

// Take over right away. Without this an installed app that is never fully
// closed keeps running the previous worker, so updates (like the badge) would
// not apply until the person force-quits the app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // An older version of the cache below.
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("phamlab-shell-") && k !== SHELL).map((k) => caches.delete(k)))),
    ])
  )
);

const SHELL = "phamlab-shell-v1";
const SCOPE = new URL(self.registration.scope).pathname; // "/phamlab-website/"

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (req.mode === "navigate") event.respondWith(page(req, url));
  else if (url.pathname.startsWith(`${SCOPE}assets/`)) event.respondWith(asset(req));
  // The site's icons (logo, app icon): kept, but fetched fresh while online since their names don't change.
  else if (url.pathname.startsWith(`${SCOPE}icons/`)) event.respondWith(page(req, url));
});

// "/x/" and "/x/index.html" are one page; the query string doesn't change it (the site routes by "#").
const pageKey = (url) => `${url.origin}${url.pathname.replace(/index\.html$/, "")}`;

// Network first, so a deploy is picked up; the kept copy only when there is no network.
async function page(req, url) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(pageKey(url), res.clone());
      await prune(cache);
    }
    return res;
  } catch {
    return (await cache.match(pageKey(url))) || Response.error();
  }
}

// Built files never change under one name, so a kept one is always right.
async function asset(req) {
  const cache = await caches.open(SHELL);
  const kept = await cache.match(req);
  if (kept) return kept;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

// Each deploy names its files anew; drop kept ones no kept page uses any more.
// (A file only a stylesheet uses is dropped too, and kept again when next loaded.)
async function prune(cache) {
  const keys = await cache.keys();
  const isAsset = (r) => new URL(r.url).pathname.startsWith(`${SCOPE}assets/`);
  const used = new Set();
  for (const p of keys.filter((r) => !isAsset(r))) {
    const res = await cache.match(p);
    if (!(res.headers.get("content-type") || "").includes("html")) continue;
    const html = await res.text();
    for (const m of html.matchAll(/assets\/[^"'\s)]+/g)) used.add(`${SCOPE}${m[0]}`);
  }
  await Promise.all(keys.filter((r) => isAsset(r) && !used.has(new URL(r.url).pathname)).map((r) => cache.delete(r)));
}

// The app-icon badge is the number of our notifications still unread. Counting
// the ones on screen (rather than a stored counter) stays right even though
// this worker is stopped between pushes, and drops when one is tapped or cleared.
// `atLeast` is 1 right after a push: some browsers (iOS) can lag in listing a
// notification they just showed, and the badge must never read 0 for it.
async function updateBadge(atLeast = 0) {
  if (!("setAppBadge" in self.navigator)) return;
  try {
    const shown = (await self.registration.getNotifications()).length;
    const unread = Math.max(shown, atLeast);
    if (unread > 0) await self.navigator.setAppBadge(unread);
    else await self.navigator.clearAppBadge();
  } catch {
    // Badging is a nicety; never let it break showing the notification.
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration
      .showNotification(data.title || "Phamlab", {
        body: data.body || "",
        icon: "icons/icon-192.png", // relative to this file, so under /phamlab-website/
        data: { url: data.url },
      })
      .then(() => updateBadge(1))
  );
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(updateBadge());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(updateBadge());
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      if (!open) return self.clients.openWindow(url);
      // An open app can't be told to go somewhere by focusing it, so ask it to
      // (src/main.tsx follows the link), then bring it to the front.
      open.postMessage({ type: "open-url", url });
      return open.focus();
    })
  );
});
