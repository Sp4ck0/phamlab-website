import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";

type Token = {
  _id: Id<"mcp_tokens">;
  label: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
};

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  // Convex wraps server errors; keep just the message we threw.
  const m = msg.match(/Uncaught Error: (.*?)(?: at |\n|$)/);
  return m?.[1] ?? "Something went wrong";
}

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Lets someone whose grant an admin has enabled for MCP register tokens for an
// AI assistant. Renders nothing when MCP isn't enabled for them.
export function McpTokens() {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  const info = useQuery(api.mcpTokens.listTokens, args);
  const create = useMutation(api.mcpTokens.createToken);
  const revoke = useMutation(api.mcpTokens.revokeToken);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!info) return null;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setMessage("Couldn't copy — select the token and copy it manually.");
    }
  }

  const tokens = info.tokens as Token[];
  const access = info.mcpAccess === "write" ? "look up and edit your trips" : "look up your trips (read-only)";

  return (
    <>
      <div className="setting-row" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="setting-label">AI assistant access (MCP)</div>
          <div className="sdek">
            Create a token so an AI assistant can {access}. Treat it like a password — you'll only see it once.
          </div>
          <form
            className="notif-confirm"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const token = await create({ ...args, label });
                setFresh(token);
                setCopied(false);
                setLabel("");
              });
            }}
          >
            <input
              className="ai-input"
              placeholder="Token name"
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Token name"
            />
            <button className="btn" type="submit" disabled={busy || !label.trim()}>
              Create token
            </button>
          </form>
          {fresh && (
            <div className="card" style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div className="sdek" style={{ margin: 0 }}>
                Copy this now — it won't be shown again.
              </div>
              <code style={{ wordBreak: "break-all", fontSize: 13 }}>{fresh}</code>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" type="button" onClick={() => void copy()}>
                  {copied ? "Copied" : "Copy"}
                </button>
                <button className="btn" type="button" onClick={() => setFresh(null)}>
                  Done
                </button>
              </div>
            </div>
          )}
          {message && (
            <div className="sdek" role="status">
              {message}
            </div>
          )}
        </div>
      </div>
      {tokens.map((t) => (
        <div className="setting-row" key={t._id} style={{ opacity: t.revokedAt ? 0.5 : 1 }}>
          <div style={{ minWidth: 0 }}>
            <div className="setting-label">{t.label}</div>
            <div className="sdek">
              {t.revokedAt
                ? `Revoked ${day(t.revokedAt)}`
                : `Created ${day(t.createdAt)} · ${t.lastUsedAt ? `last used ${day(t.lastUsedAt)}` : "never used"}`}
            </div>
          </div>
          {!t.revokedAt && (
            <button className="btn" disabled={busy} onClick={() => void run(() => revoke({ ...args, id: t._id }))}>
              Revoke
            </button>
          )}
        </div>
      ))}
    </>
  );
}
