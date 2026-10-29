import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";

const inputStyle = {
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 16,
  fontFamily: "inherit",
  background: "var(--card)",
  color: "var(--text-primary)",
} as const;

interface TripChoice {
  tripId: Id<"travel_trips">;
  title: string;
  start?: string;
  end?: string;
}

const fmtRange =(start?: string, end?: string) => (start && end ? `${start} → ${end}` : "");

// Consent screen for a connector (e.g. ChatGPT) that started an OAuth flow at
// the backend's /oauth/authorize. Trip content only leaves after Approve, and
// only for the trips ticked here.
export function ConnectPage() {
  const [params] = useSearchParams();
  const req = params.get("req");
  const { code, set } = useAccessCode();
  const info = useQuery(api.oauth.getAuthRequest, req ? { req, ...(code ? { code } : {}) } : "skip");
  const approve = useMutation(api.oauth.approve);
  const deny = useMutation(api.oauth.deny);
  const attemptAccessCode = useMutation(api.trips.attemptAccessCode);

  const [selected, setSelected] = useState<Set<Id<"travel_trips">>>(new Set());
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");

  if (!req || info === null) {
    return (
      <PageShell>
        <div style={{ maxWidth: 520, margin: "80px auto", padding: "0 20px" }}>
          <h2 className="shead" style={{ marginTop: 0 }}>
            This connection request has expired
          </h2>
          <p className="sdek">Go back to the app you were connecting and start again.</p>
        </div>
      </PageShell>
    );
  }
  if (info === undefined) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await attemptAccessCode({ code: codeInput.trim() });
      if (result.valid) set(codeInput.trim());
      else setError("That code didn't unlock anything — double check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(action: "approve" | "deny") {
    setError(null);
    setBusy(true);
    try {
      const { redirectUrl } =
        action === "approve"
          ? await approve({ req: req!, ...(code ? { code } : {}), tripIds: [...selected], sensitive })
          : await deny({ req: req! });
      window.location.assign(redirectUrl);
    } catch {
      setError("Couldn't complete that — the request may have expired, or your access changed. Start again from the app.");
      setBusy(false);
    }
  }

  const toggle = (id: Id<"travel_trips">) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <PageShell>
      <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 20px" }}>
        <h2 className="shead" style={{ marginTop: 0 }}>
          Connect {info.clientName}
        </h2>
        <p className="sdek">
          <strong>{info.clientName}</strong> (returns to <code>{info.redirectHost}</code>) wants to read your itineraries. It can only
          read — it can't change anything.
        </p>

        {info.signedInAs === null ? (
          <>
            <p className="sdek">Sign in or enter your trip code to choose what to share.</p>
            <p className="sdek">
              <Link to={`/login?next=${encodeURIComponent(`/connect?req=${req}`)}`} style={{ color: "var(--accent-1)" }}>
                Log in
              </Link>
            </p>
            <form onSubmit={submitCode} style={{ display: "flex", gap: 10 }}>
              <label htmlFor="connect-code" className="sdek" style={{ display: "none" }}>
                Access code
              </label>
              <input
                id="connect-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Access code"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button className="btn" type="submit" disabled={busy || !codeInput.trim()}>
                {busy ? "Checking…" : "Continue"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="sdek">Signed in with {info.signedInAs === "user" ? "your account" : "your access code"}.</p>
            <fieldset style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", margin: "16px 0" }}>
              <legend className="sdek">Trips to share</legend>
              {info.trips.length === 0 && <p className="sdek">You don't have any trips to share.</p>}
              {info.trips.map((t: TripChoice) => (
                <label key={t.tripId} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0" }}>
                  <input type="checkbox" checked={selected.has(t.tripId)} onChange={() => toggle(t.tripId)} disabled={busy} />
                  <span>
                    {t.title} <span className="sdek">{fmtRange(t.start, t.end)}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label style={{ display: "flex", gap: 10, alignItems: "baseline", margin: "12px 0" }}>
              <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} disabled={busy} />
              <span>
                Also share sensitive details
                <span className="sdek" style={{ display: "block" }}>
                  Hotel addresses, prices, booking notes and group notes. Off by default.
                </span>
              </span>
            </label>

            <p className="sdek">
              What you share is sent to {info.clientName} and the AI service behind it, and is handled under their terms. You can
              disconnect any time from Settings → Connected apps.
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn" type="button" onClick={() => finish("approve")} disabled={busy || selected.size === 0}>
                {busy ? "Working…" : `Allow read access${selected.size ? ` (${selected.size})` : ""}`}
              </button>
              <button className="btn" type="button" onClick={() => finish("deny")} disabled={busy}>
                Cancel
              </button>
            </div>
          </>
        )}

        <p className="sdek" role="alert" aria-live="polite" style={{ color: "var(--danger)", marginTop: 14, minHeight: "1.4em" }}>
          {error}
        </p>
      </div>
    </PageShell>
  );
}
