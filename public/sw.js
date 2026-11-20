// Service worker: shows push notifications and opens the site when one is
// tapped. It does no caching, so the site is never served stale.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // not JSON; fall back to the defaults below
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "phamlab", {
      body: data.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Always open this site's own scope, never a URL taken from the payload.
  const target = self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(target));
      return open ? open.focus() : self.clients.openWindow(target);
    }),
  );
});
