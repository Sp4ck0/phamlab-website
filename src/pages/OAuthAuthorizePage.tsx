import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  // Convex wraps server errors; keep just the message we threw.
  const m = msg.match(/Uncaught Error: (.*?)(?: at |\n|$)/);
  return m?.[1] ?? "Something went wrong";
}

// Where an AI app (ChatGPT, Claude, …) sends someone to approve its connection.
// /oauth/authorize on the backend redirects here with ?request=<id>; Allow and
// Deny bounce the browser back to the app.
export function OAuthAuthorizePage() {
  const [params] = useSearchParams();
  const requestId = params.get("request");
  const { code: savedCode } = useAccessCode();
  // A code typed here is used for this approval only — it isn't saved, so it
  // doesn't change who the rest of the site thinks you are.
  const [entered, setEntered] = useState("");
  const code = entered.trim() || savedCode;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const info = useQuery(api.oauth.getRequest, requestId ? { requestId, ...(code ? { code } : {}) } : "skip");
  const approve = useMutation(api.oauth.approve);
  const deny = useMutation(api.oauth.deny);

  async function go(fn: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try {
      window.location.assign(await fn());
    } catch (e) {
      setMessage(errorText(e));
      setBusy(false);
    }
  }

  // Typing a code changes the query args, which makes `info` undefined for a
  // moment. Keep showing the last loaded view meanwhile so the input isn't
  // unmounted (and loses focus) after every keystroke.
  const last = useRef<typeof info>(undefined);
  if (info) last.current = info;
  const view = info ?? last.current;
  const reloading = info === undefined && view !== undefined;

  let body;
  if (view === undefined && requestId) {
    body = <div style={{ color: "var(--text-muted)" }}>Loading…</div>;
  } else if (!requestId || info === null || view === undefined) {
    body = (
      <>
        <h2 className="shead" style={{ marginTop: 0 }}>
          Request expired
        </h2>
        <p className="sdek">This connection request is no longer valid. Start again from the app.</p>
      </>
    );
  } else {
    const canWrite = view.access === "write";
    body = (
      <>
        <h2 className="shead" style={{ marginTop: 0 }}>
          Connect {view.clientName}?
        </h2>
        {(view.access === null || entered) && (
          <>
            {view.access === null && (
              <p className="sdek">
                MCP access isn't turned on for your account. If you have an access code that includes it, enter it
                here.
              </p>
            )}
            <input
              className="ai-input"
              placeholder="Access code"
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              aria-label="Access code"
            />
          </>
        )}
        {view.access !== null && (
          <>
            <p className="sdek">
              <strong>{view.clientName}</strong> is asking to connect to your trips. It will be able to:
            </p>
            <ul className="sdek" style={{ paddingLeft: 20 }}>
              <li>Look up your trips — days, flights, hotels, action items and weather</li>
              {canWrite && <li>Create and edit trips and action items</li>}
              {!canWrite && <li>Nothing else — this connection is read-only</li>}
            </ul>
            <p className="sdek">
              After you decide, you'll be sent back to <code>{view.redirectHost}</code>. Only approve apps you
              trust. You can disconnect it any time in Settings.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                disabled={busy || reloading}
                onClick={() => void go(() => approve({ requestId: requestId!, ...(code ? { code } : {}) }))}
              >
                Allow
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void go(() => deny({ requestId: requestId! }))}
              >
                Deny
              </button>
            </div>
          </>
        )}
        {message && (
          <p className="sdek" role="status">
            {message}
          </p>
        )}
      </>
    );
  }

  return (
    <PageShell>
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 20px" }}>{body}</div>
    </PageShell>
  );
}
