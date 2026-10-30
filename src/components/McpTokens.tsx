import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";
import { SettingsSection } from "./SettingsSection";

type Connection = {
  _id: Id<"mcp_tokens">;
  label: string;
  createdAt: number;
  lastUsedAt?: number;
};

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  // Convex wraps server errors; keep just the message we threw.
  const m = msg.match(/Uncaught Error: (.*?)(?: at |\n|$)/);
  return m?.[1] ?? "Something went wrong";
}

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// The MCP server address: the Convex deployment's HTTP origin plus /mcp.
const MCP_URL = `${String(import.meta.env.VITE_CONVEX_URL).replace(".convex.cloud", ".convex.site")}/mcp`;

// How to connect an AI assistant, and the apps already connected. Renders
// nothing when an admin hasn't enabled MCP for the viewer.
export function McpTokens() {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  const info = useQuery(api.mcpTokens.listTokens, args);
  const revoke = useMutation(api.mcpTokens.revokeToken);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!info) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
    } catch {
      setMessage("Couldn't copy — select the address and copy it manually.");
    }
  }

  async function remove(id: Id<"mcp_tokens">) {
    setBusy(true);
    setMessage("");
    try {
      await revoke({ ...args, id });
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const apps = info.tokens as Connection[];
  const access = info.mcpAccess === "write" ? "look up and edit your trips" : "look up your trips (read-only)";

  return (
    <SettingsSection title="AI assistants">
      <div className="setting-row" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="setting-label">AI assistant access (MCP)</div>
          <div className="sdek">
            Connect an AI assistant so it can {access}. Add this address as a connector, then approve the connection when
            it sends you back here.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <code style={{ wordBreak: "break-all", fontSize: 13 }}>{MCP_URL}</code>
            <button className="btn" type="button" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </button>
            <Link className="btn btn--lg" to="/guide">
              Guide
            </Link>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="sdek" style={{ cursor: "pointer" }}>
              How do I connect it?
            </summary>
            <ul className="sdek" style={{ paddingLeft: 20 }}>
              <li>
                <strong>ChatGPT:</strong> on the left pane, select "Plugins". Then click "Add" at the top right →
                "Add Custom MCP Server". For Connection, use this address, and choose OAuth.
              </li>
              <li>
                <strong>Claude:</strong> Settings → Connectors → Add custom connector, and paste the address.
              </li>
              <li>
                <strong>Claude Code:</strong> run <code>claude mcp add --transport http phamlab {MCP_URL}</code>, then{" "}
                <code>/mcp</code> and choose Authenticate.
              </li>
            </ul>
          </details>
          {message && (
            <div className="sdek" role="status">
              {message}
            </div>
          )}
        </div>
      </div>
      {apps.map((a) => (
        <div className="setting-row" key={a._id}>
          <div style={{ minWidth: 0 }}>
            <div className="setting-label">{a.label}</div>
            <div className="sdek">
              Connected {day(a.createdAt)} · {a.lastUsedAt ? `last used ${day(a.lastUsedAt)}` : "not used yet"}
            </div>
          </div>
          <button className="btn" disabled={busy} onClick={() => void remove(a._id)}>
            Disconnect
          </button>
        </div>
      ))}
    </SettingsSection>
  );
}
