import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";

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

  if (trips === undefined || boards === undefined || codes === undefined) {
    return <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>;
  }

  return (
    <div style={{ padding: "40px 0 0" }}>
      <h2 className="shead" style={{ marginTop: 0 }}>
        Manage access
      </h2>
      <p className="sdek">Create access codes and control which trips and boards each one unlocks.</p>

      <NewCodeForm code={code} trips={trips} boards={boards} existingCodes={codes.map((c) => c.code)} />

      <WhoHasAccess code={code} trips={trips} boards={boards} codes={codes} />

      <h2 className="section-title" style={{ marginTop: 40 }}>
        Existing codes
      </h2>
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
    </div>
  );
}

// Year first so a long list of trips is easy to place in time; the nav bar
// already shows the year under each title, so only the manage page needs it.
function tripLabel(t: TripRow) {
  const year = t.start?.slice(0, 4);
  return `${year ? `${year} ` : ""}${t.navIcon} ${t.title}`;
}

function TripCheckboxes({ trips, selected, onChange }: { trips: TripRow[]; selected: string[]; onChange: (tripIds: string[]) => void }) {
  function toggle(tripId: string) {
    onChange(selected.includes(tripId) ? selected.filter((id) => id !== tripId) : [...selected, tripId]);
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {trips.map((t) => (
        <button
          key={t._id}
          type="button"
          className="chip"
          aria-pressed={selected.includes(t._id)}
          onClick={() => toggle(t._id)}
        >
          {tripLabel(t)}
        </button>
      ))}
    </div>
  );
}

function BoardCheckboxes({ boards, selected, onChange }: { boards: BoardRow[]; selected: string[]; onChange: (boardIds: string[]) => void }) {
  function toggle(boardId: string) {
    onChange(selected.includes(boardId) ? selected.filter((id) => id !== boardId) : [...selected, boardId]);
  }
  if (boards.length === 0) {
    return <p className="sdek" style={{ margin: 0 }}>No boards yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {boards.map((b) => (
        <button
          key={b._id}
          type="button"
          className="chip"
          aria-pressed={selected.includes(b._id)}
          onClick={() => toggle(b._id)}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}

function AccessSections({
  trips,
  boards,
  tripIds,
  boardIds,
  datingAccess,
  onTripsChange,
  onBoardsChange,
  onDatingAccessChange,
}: {
  trips: TripRow[];
  boards: BoardRow[];
  tripIds: string[];
  boardIds: string[];
  datingAccess: boolean;
  onTripsChange: (tripIds: string[]) => void;
  onBoardsChange: (boardIds: string[]) => void;
  onDatingAccessChange: (datingAccess: boolean) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div className="ctype" style={{ marginBottom: 6 }}>
          Trips
        </div>
        <TripCheckboxes trips={trips} selected={tripIds} onChange={onTripsChange} />
      </div>
      <div>
        <div className="ctype" style={{ marginBottom: 6 }}>
          Boards
        </div>
        <BoardCheckboxes boards={boards} selected={boardIds} onChange={onBoardsChange} />
      </div>
      <div>
        <div className="ctype" style={{ marginBottom: 6 }}>
          Dating Simulator
        </div>
        <button
          type="button"
          className="chip"
          aria-pressed={datingAccess}
          onClick={() => onDatingAccessChange(!datingAccess)}
        >
          {datingAccess ? "Enabled" : "Disabled"}
        </button>
      </div>
    </div>
  );
}

function NewCodeForm({
  code,
  trips,
  boards,
  existingCodes,
}: {
  code: string;
  trips: TripRow[];
  boards: BoardRow[];
  existingCodes: string[];
}) {
  const upsert = useMutation(api.management.upsertAccessCode);
  const [newCode, setNewCode] = useState("");
  const [name, setName] = useState("");
  const [tripIds, setTripIds] = useState<string[]>([]);
  const [boardIds, setBoardIds] = useState<string[]>([]);
  const [datingAccess, setDatingAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = newCode.trim().toLowerCase();
    if (!normalized) {
      setError("Enter a code.");
      return;
    }
    if (!name.trim()) {
      setError("Enter a name.");
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
        tripIds: tripIds as any,
        boardIds: boardIds as any,
        datingAccess,
        name: name.trim(),
        active: true,
      });
      setNewCode("");
      setName("");
      setTripIds([]);
      setBoardIds([]);
      setDatingAccess(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <div className="ctype">New access code</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name — e.g. Tony's cousins"
        required
        style={inputStyle}
      />
      <input
        value={newCode}
        onChange={(e) => setNewCode(e.target.value)}
        placeholder="Code — e.g. sunshine"
        style={inputStyle}
      />
      <AccessSections
        trips={trips}
        boards={boards}
        tripIds={tripIds}
        boardIds={boardIds}
        datingAccess={datingAccess}
        onTripsChange={setTripIds}
        onBoardsChange={setBoardIds}
        onDatingAccessChange={setDatingAccess}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button className="btn" type="submit" disabled={submitting} style={{ justifySelf: "start" }}>
        {submitting ? "Creating…" : "Create code"}
      </button>
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
        <th scope="row" style={{ ...cellStyle, textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>
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
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--page)",
  color: "var(--text-primary)",
};
