// Service worker for push notifications only: no caching and no fetch
// handler, so the site always loads live. Registered from src/main.tsx.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Phamlab", {
      body: data.body || "",
      icon: "icons/icon-192.png", // relative to this file, so under /phamlab-website/
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
