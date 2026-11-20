// Service worker for push notifications only: no caching and no fetch
// handler, so the site always loads live. Registered from src/main.tsx.

// Take over right away. Without this an installed app that is never fully
// closed keeps running the previous worker, so updates (like the badge) would
// not apply until the person force-quits the app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
