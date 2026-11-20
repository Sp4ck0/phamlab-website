// Which "add to home screen" flow applies. Pure, so it can be unit-tested.
export type Platform = "installed" | "in-app" | "ios" | "other";

// Browsers embedded in other apps can't install anything.
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|GSA\/|; wv\)/i;

export function detectPlatform(ua: string, standalone: boolean, maxTouchPoints = 0): Platform {
  if (standalone) return "installed";
  if (IN_APP.test(ua)) return "in-app";
  // iPadOS 13+ reports a Mac user agent, so tell it apart by touch support.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  return ios ? "ios" : "other";
}
