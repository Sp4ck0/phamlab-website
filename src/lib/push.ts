// Helpers for turning on push notifications on this device. Pure, so they can
// be unit-tested without a browser.

export type PushSupport = "ok" | "needs-install" | "unsupported";

/**
 * Can this device get pushes? iPhone/iPad only allow Web Push inside the
 * Home Screen app, so there the answer in Safari is "needs-install".
 */
export function pushSupport({ hasPush, ios, standalone }: { hasPush: boolean; ios: boolean; standalone: boolean }): PushSupport {
  if (hasPush) return "ok";
  return ios && !standalone ? "needs-install" : "unsupported";
}

export function isIos(ua: string, maxTouchPoints = 0) {
  // iPadOS reports a Mac user agent, so tell it apart by touch support.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** A short name for the device, shown in the channel list ("iPhone", "Mac"…). */
export function deviceLabel(ua: string, maxTouchPoints = 0) {
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Linux/.test(ua)) return "Linux";
  return "This device";
}

/** The VAPID public key arrives base64url; pushManager.subscribe wants bytes. */
export function urlBase64ToUint8Array(base64Url: string) {
  const padded = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
