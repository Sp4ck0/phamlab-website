import { detectPlatform } from "./platform";

// Chrome/Edge/Android fire this when the site is installable.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SITE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const addBtn = $<HTMLButtonElement>("pwa-add");
const msg = $("pwa-msg");
const iosSheet = $("pwa-ios");
const inAppSheet = $("pwa-inapp");

const standalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const platform = detectPlatform(navigator.userAgent, standalone, navigator.maxTouchPoints);

// Only phones need this page. Opened from the home screen (iOS may launch the
// saved page, not start_url) or on a computer, go straight to the site.
if (platform === "installed" || platform === "desktop") location.replace(SITE);
else document.documentElement.classList.add("ready"); // reveal the page (hidden in CSS until now)

// iPhone has no install API and no way to open the "Add to Home Screen" action
// from a page (navigator.share shows a different, shorter sheet without it),
// so show the steps for Safari's own Share button straight away.
if (platform === "ios") {
  addBtn.hidden = true;
  iosSheet.hidden = false;
}

let deferred: InstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
});

function done() {
  msg.textContent = "Added. Find phamlab on your home screen.";
  msg.hidden = false;
  addBtn.hidden = true;
}
window.addEventListener("appinstalled", done);

addBtn.addEventListener("click", async () => {
  if (deferred) {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === "accepted") done();
  } else if (platform === "in-app") {
    inAppSheet.hidden = false;
  } else {
    msg.style.color = "var(--text-secondary)";
    msg.textContent = "Use your browser’s menu → Install app / Add to Home Screen.";
    msg.hidden = false;
  }
});

$("pwa-copy").addEventListener("click", async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  try {
    await navigator.clipboard.writeText(location.href);
    btn.textContent = "Copied";
  } catch {
    btn.textContent = "Copy the address bar link";
  }
});
