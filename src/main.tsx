import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import "./styles/globals.css";
import App from "./App.tsx";
import { AccessCodeProvider } from "./hooks/useAccessCode";
import { SettingsProvider } from "./hooks/useSettings";

// Makes the site installable and lets it receive push notifications (public/sw.js).
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

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
