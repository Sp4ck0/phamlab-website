import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";
import { useRememberTab } from "../hooks/useRememberTab";

interface TripRow {
  _id: string;
  slug: string;
  title: string;
  navIcon: string;
  start?: string;
}
interface BoardRow {
  _id: string;
  name: string;
}
interface CodeRow {
  _id: string;
  code: string;
  name: string;
  active: boolean;
  tripIds: string[];
  boardIds: string[];
  datingAccess: boolean;
}

export function ManagePage() {
  const { code } = useAccessCode();
  const isAuthorized = useQuery(api.management.checkManagementAccess, code ? { code } : "skip");
  useRememberTab(isAuthorized ? "/manage" : null);

  // Without a code the query is skipped and useQuery returns undefined
  // forever — that must fall through to "Not authorized" below, not the
  // loading state, or a visitor with no code saved gets stuck on
  // "Loading…" indefinitely.
  if (code && isAuthorized === undefined) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }

  if (!isAuthorized) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0" }}>
          <h2 className="shead" style={{ marginTop: 0 }}>
            Not authorized
          </h2>
          <p className="sdek">
            This page is restricted. <Link to="/unlock" style={{ color: "var(--accent-1)" }}>Enter a code</Link>.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ManagementConsole code={code!} />
    </PageShell>
  );
}

function ManagementConsole({ code }: { code: string }) {
  const trips = useQuery(api.management.listTrips, { code }) as TripRow[] | undefined;
  const boards = useQuery(api.management.listBoards, { code }) as BoardRow[] | undefined;
  const codes = useQuery(api.management.listAccessCodes, { code }) as CodeRow[] | undefined;
  const [adding, setAdding] = useState(false);

  if (trips === undefined || boards === undefined || codes === undefined) {
    return <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>;
  }

  return (
    <div style={{ padding: "40px 0 0" }}>
      <h2 className="shead" style={{ marginTop: 0 }}>
        Manage access
      </h2>
      <p className="sdek">Create access codes and control which trips and boards each one unlocks.</p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Existing codes
        </h2>
        {!adding && (
          <button className="btn" type="button" onClick={() => setAdding(true)}>
            + Add code
          </button>
        )}
      </div>
      {adding && (
        <AddCodeForm code={code} existingCodes={codes.map((c) => c.code)} onDone={() => setAdding(false)} />
      )}
      {codes.length === 0 ? (
        <p className="sdek">No access codes yet.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Name", "Code", "", "Status", ""].map((h, i) => (
                  <th key={i} scope="col" style={{ ...cellStyle, textAlign: "left", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <CodeTableRow key={c._id} code={code} row={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WhoHasAccess code={code} trips={trips} boards={boards} codes={codes} />
    </div>
  );
}

// Year first so a long list of trips is easy to place in time; the nav bar
// already shows the year under each title, so only the manage page needs it.
function tripLabel(t: TripRow) {
  const year = t.start?.slice(0, 4);
  return `${year ? `${year} ` : ""}${t.navIcon} ${t.title}`;
}

// Name + code only: what each code unlocks is set afterwards in the "Who has
// access" grid below, so there is one place to manage trips/boards/dating.
function AddCodeForm({ code, existingCodes, onDone }: { code: string; existingCodes: string[]; onDone: () => void }) {
  const upsert = useMutation(api.management.upsertAccessCode);
  const [name, setName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function generate() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    setNewCode(Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(""));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = newCode.trim().toLowerCase();
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    if (!normalized) {
      setError("Enter a code, or generate one.");
      return;
    }
    if (existingCodes.includes(normalized)) {
      setError(`Code "${normalized}" already exists.`);
      return;
    }
    setSubmitting(true);
    try {
      await upsert({
        code,
        targetCode: newCode,
        tripIds: [] as any,
        boardIds: [] as any,
        datingAccess: false,
        name: name.trim(),
        active: true,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
      className="card"
      style={{ display: "grid", gap: 12, maxWidth: 560, marginTop: 14 }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name — e.g. Tony's cousins"
        aria-label="Name"
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Code — e.g. sunshine"
          aria-label="Code"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
        <button className="btn" type="button" onClick={generate}>
          Generate
        </button>
      </div>
      <p className="sdek" style={{ margin: 0, fontSize: 13 }}>
        The new code starts with no access — turn on trips and boards in the grid below.
      </p>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add code"}
        </button>
        <button className="btn" type="button" onClick={onDone} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// The inverse of the per-code cards below: one row per trip/board, with a chip
// per code, so "who can see X?" is answered without scanning every code.
function WhoHasAccess({
  code,
  trips,
  boards,
  codes,
}: {
  code: string;
  trips: TripRow[];
  boards: BoardRow[];
  codes: CodeRow[];
}) {
  const upsert = useMutation(api.management.upsertAccessCode);
  const [busy, setBusy] = useState(false);

  async function toggleDating(row: CodeRow) {
    setBusy(true);
    try {
      await upsert({
        code,
        id: row._id as any,
        targetCode: row.code,
        tripIds: row.tripIds as any,
        boardIds: row.boardIds as any,
        datingAccess: !row.datingAccess,
        name: row.name,
        active: row.active,
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: CodeRow, kind: "tripIds" | "boardIds", id: string) {
    const current = row[kind];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setBusy(true);
    try {
      await upsert({
        code,
        id: row._id as any,
        targetCode: row.code,
        tripIds: (kind === "tripIds" ? next : row.tripIds) as any,
        boardIds: (kind === "boardIds" ? next : row.boardIds) as any,
        datingAccess: row.datingAccess,
        name: row.name,
        active: row.active,
      });
    } finally {
      setBusy(false);
    }
  }

  function renderRows(items: { id: string; label: string }[], kind: "tripIds" | "boardIds") {
    return items.map((item) => (
      <tr key={item.id}>
        <th scope="row" style={{ ...cellStyle, textAlign: "left", fontWeight: 500, whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--card)" }}>
          {item.label}
        </th>
        {codes.map((c) => {
          const has = c[kind].includes(item.id);
          return (
            <td key={c._id} style={{ ...cellStyle, textAlign: "center", opacity: c.active ? 1 : 0.5 }}>
              <button
                type="button"
                className="chip"
                aria-pressed={has}
                aria-label={`${c.name}: ${item.label}`}
                disabled={busy}
                style={{ minWidth: 32, justifyContent: "center" }}
                onClick={() => toggle(c, kind, item.id)}
              >
                {has ? "✓" : "–"}
              </button>
            </td>
          );
        })}
      </tr>
    ));
  }

  return (
    <>
      <h2 className="section-title" style={{ marginTop: 40 }}>
        Who has access
      </h2>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={cellStyle} />
              {codes.map((c) => (
                <th key={c._id} scope="col" style={{ ...cellStyle, fontWeight: 500, opacity: c.active ? 1 : 0.5 }}>
                  {c.name}
                  {c.active ? "" : " (inactive)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th colSpan={codes.length + 1} className="ctype" style={{ ...cellStyle, textAlign: "left" }}>
                Trips
              </th>
            </tr>
            {renderRows(trips.map((t) => ({ id: t._id, label: tripLabel(t) })), "tripIds")}
            {boards.length > 0 && (
              <tr>
                <th colSpan={codes.length + 1} className="ctype" style={{ ...cellStyle, textAlign: "left" }}>
                  Boards
                </th>
              </tr>
            )}
            {renderRows(boards.map((b) => ({ id: b._id, label: b.name })), "boardIds")}
            <tr>
              <th colSpan={codes.length + 1} className="ctype" style={{ ...cellStyle, textAlign: "left" }}>
                Dating Simulator
              </th>
            </tr>
            <tr>
              <th scope="row" style={{ ...cellStyle, textAlign: "left", fontWeight: 500 }}>
                Enabled
              </th>
              {codes.map((c) => (
                <td key={c._id} style={{ ...cellStyle, textAlign: "center", opacity: c.active ? 1 : 0.5 }}>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={c.datingAccess}
                    aria-label={`${c.name}: Dating Simulator`}
                    disabled={busy}
                    style={{ minWidth: 32, justifyContent: "center" }}
                    onClick={() => toggleDating(c)}
                  >
                    {c.datingAccess ? "✓" : "–"}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

const cellStyle: CSSProperties = { padding: "6px 10px", borderBottom: "1px solid var(--border)" };

function CodeTableRow({ code, row }: { code: string; row: CodeRow }) {
  const upsert = useMutation(api.management.upsertAccessCode);
  const del = useMutation(api.management.deleteAccessCode);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      await upsert({
        code,
        id: row._id as any,
        targetCode: row.code,
        tripIds: row.tripIds as any,
        boardIds: row.boardIds as any,
        datingAccess: row.datingAccess,
        name: row.name,
        active: !row.active,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del({ code, id: row._id as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={{ opacity: busy ? 0.6 : 1 }}>
      <th scope="row" style={{ ...cellStyle, textAlign: "left", fontWeight: 500 }}>
        {row.name}
      </th>
      <td style={{ ...cellStyle, fontFamily: "monospace", letterSpacing: 1 }}>
        {revealed ? row.code : `${row.code.charAt(0)}${"•".repeat(8)}`}
      </td>
      <td style={cellStyle}>
        <button
          className="btn"
          onClick={() => setRevealed((r) => !r)}
          disabled={busy}
          style={{ padding: "2px 10px", fontSize: 12 }}
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
      </td>
      <td style={cellStyle}>
        <button className="btn" aria-pressed={row.active} onClick={toggleActive} disabled={busy}>
          {row.active ? "Active" : "Inactive"}
        </button>
      </td>
      <td style={cellStyle}>
        <button className="btn" onClick={remove} disabled={busy} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
          Delete
        </button>
      </td>
    </tr>
  );
}

const inputStyle: CSSProperties = {
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 16,
  fontFamily: "inherit",
  background: "var(--page)",
  color: "var(--text-primary)",
};
