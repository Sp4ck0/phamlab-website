import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import "./styles/globals.css";
import App from "./App.tsx";
import { AccessCodeProvider } from "./hooks/useAccessCode";
import { SettingsProvider } from "./hooks/useSettings";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Only for push notifications (public/sw.js): it caches nothing.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
  // Opening the app means the notifications have been seen: clear them and the icon badge.
  const clearSeen = () => {
    if (document.visibilityState !== "visible") return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.getNotifications())
      .then((list) => list.forEach((n) => n.close()))
      .catch(() => {});
    void (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {});
  };
  document.addEventListener("visibilitychange", clearSeen);
  clearSeen();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <AccessCodeProvider>
        <SettingsProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </SettingsProvider>
      </AccessCodeProvider>
    </ConvexAuthProvider>
  </StrictMode>
);
