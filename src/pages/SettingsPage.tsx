import { Link, useNavigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";
import { useSettings } from "../hooks/useSettings";
import { clearLastTab } from "../lib/lastTab";

export function SettingsPage() {
  const { code, clear } = useAccessCode();
  const { tempUnit, setTempUnit } = useSettings();
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  // undefined = loading, null = no grant (no code and not logged in).
  const settings = useQuery(api.settings.getSettings, code ? { code } : {});

  async function handleLogout() {
    clear();
    clearLastTab();
    if (isAuthenticated) await signOut();
    navigate("/unlock");
  }

  if (settings === undefined) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }

  if (settings === null) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0" }}>
          <h2 className="shead" style={{ marginTop: 0 }}>
            Not signed in
          </h2>
          <p className="sdek">
            Settings are saved to your access. <Link to="/unlock" style={{ color: "var(--accent-1)" }}>Enter a code</Link>.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div style={{ padding: "40px 0" }}>
        <h2 className="shead" style={{ marginTop: 0 }}>
          Settings
        </h2>
        <div className="setting-row">
          <div>
            <div className="setting-label">Temperature</div>
            <div className="sdek">Used for weather on days and the map.</div>
          </div>
          <button
            type="button"
            role="switch"
            className="unit-toggle"
            aria-checked={tempUnit === "C"}
            aria-label="Temperature unit, Celsius"
            onClick={() => setTempUnit(tempUnit === "F" ? "C" : "F")}
          >
            <span data-on={tempUnit === "F" ? "true" : undefined}>°F</span>
            <span data-on={tempUnit === "C" ? "true" : undefined}>°C</span>
          </button>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Account</div>
            <div className="sdek">Forget this device's access code and sign out.</div>
          </div>
          <button className="btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </PageShell>
  );
}
