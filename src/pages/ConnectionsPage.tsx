import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";

interface Connection {
  connectionId: Id<"mcp_connections">;
  clientName: string;
  tripTitles: string[];
  sensitive: boolean;
  createdAt: number;
  lastUsedAt?: number;
}

const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleString() : "never");

// Apps (e.g. ChatGPT) the current user/code has connected for read access.
export function ConnectionsPage() {
  const { code } = useAccessCode();
  const connections = useQuery(api.oauth.listConnections, code ? { code } : {});
  const revoke = useMutation(api.oauth.revokeConnection);
  const [busyId, setBusyId] = useState<Id<"mcp_connections"> | null>(null);
  const [status, setStatus] = useState<string>("");

  async function disconnect(id: Id<"mcp_connections">, name: string) {
    setBusyId(id);
    setStatus("");
    try {
      await revoke({ connectionId: id, ...(code ? { code } : {}) });
      setStatus(`${name} was disconnected.`);
    } catch {
      setStatus(`Couldn't disconnect ${name} — try again.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageShell>
      <div style={{ padding: "40px 0", maxWidth: 640 }}>
        <h2 className="shead" style={{ marginTop: 0 }}>
          Connected apps
        </h2>
        <p className="sdek">
          Apps you've allowed to read your itineraries. Disconnecting takes effect immediately. <Link to="/settings" style={{ color: "var(--accent-1)" }}>Back to Settings</Link>
        </p>

        {connections === undefined && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {connections && connections.length === 0 && (
          <p className="sdek">No connected apps. If you expected some, make sure you're signed in or have entered your access code.</p>
        )}
        {connections?.map((c: Connection) => (
          <div key={c.connectionId} className="setting-row">
            <div>
              <div className="setting-label">{c.clientName}</div>
              <div className="sdek">
                {c.tripTitles.join(", ") || "No trips"}
                {c.sensitive ? " · includes sensitive details" : ""}
              </div>
              <div className="sdek">
                Connected {fmt(c.createdAt)} · last used {fmt(c.lastUsedAt)}
              </div>
            </div>
            <button className="btn" type="button" disabled={busyId === c.connectionId} onClick={() => disconnect(c.connectionId, c.clientName)}>
              {busyId === c.connectionId ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ))}
        <p className="sdek" role="status" aria-live="polite" style={{ minHeight: "1.4em", marginTop: 14 }}>
          {status}
        </p>
      </div>
    </PageShell>
  );
}
