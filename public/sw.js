// Service worker for push notifications only: no caching and no fetch
// handler, so the site always loads live. Registered from src/main.tsx.
// The app-icon badge is the number of our notifications still unread. Counting
// the ones on screen (rather than a stored counter) stays right even though
// this worker is stopped between pushes, and drops when one is tapped or cleared.
async function updateBadge() {
  if (!("setAppBadge" in self.navigator)) return;
  try {
    const unread = (await self.registration.getNotifications()).length;
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
      .then(updateBadge)
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
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
