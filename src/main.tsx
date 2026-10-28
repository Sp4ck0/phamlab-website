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
