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
}
interface CodeRow {
  _id: string;
  code: string;
  label?: string;
  active: boolean;
  tripIds: string[];
}

export function ManagePage() {
  const { code } = useAccessCode();
  const isAuthorized = useQuery(api.management.checkManagementAccess, code ? { code } : "skip");

  if (isAuthorized === undefined) {
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
  const codes = useQuery(api.management.listAccessCodes, { code }) as CodeRow[] | undefined;

  if (trips === undefined || codes === undefined) {
    return <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>;
  }

  return (
    <div style={{ padding: "40px 0 0" }}>
      <h2 className="shead" style={{ marginTop: 0 }}>
        Manage access
      </h2>
      <p className="sdek">Create access codes and control which trips each one unlocks.</p>

      <NewCodeForm code={code} trips={trips} existingCodes={codes.map((c) => c.code)} />

      <h2 className="section-title" style={{ marginTop: 40 }}>
        Existing codes
      </h2>
      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {codes.length === 0 && <p className="sdek">No access codes yet.</p>}
        {codes.map((c) => (
          <CodeRowEditor key={c._id} code={code} row={c} trips={trips} />
        ))}
      </div>
    </div>
  );
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
          <span>{t.navIcon}</span>
          {t.title}
        </button>
      ))}
    </div>
  );
}

function NewCodeForm({ code, trips, existingCodes }: { code: string; trips: TripRow[]; existingCodes: string[] }) {
  const upsert = useMutation(api.management.upsertAccessCode);
  const [newCode, setNewCode] = useState("");
  const [label, setLabel] = useState("");
  const [tripIds, setTripIds] = useState<string[]>([]);
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
    if (!label.trim()) {
      setError("Enter a label.");
      return;
    }
    if (existingCodes.includes(normalized)) {
      setError(`Code "${normalized}" already exists.`);
      return;
    }
    setSubmitting(true);
    try {
      await upsert({ code, targetCode: newCode, tripIds: tripIds as any, label: label.trim(), active: true });
      setNewCode("");
      setLabel("");
      setTripIds([]);
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
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label — e.g. Tony's cousins"
        required
        style={inputStyle}
      />
      <input
        value={newCode}
        onChange={(e) => setNewCode(e.target.value)}
        placeholder="Code — e.g. sunshine"
        style={inputStyle}
      />
      <TripCheckboxes trips={trips} selected={tripIds} onChange={setTripIds} />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button className="btn" type="submit" disabled={submitting} style={{ justifySelf: "start" }}>
        {submitting ? "Creating…" : "Create code"}
      </button>
    </form>
  );
}

function CodeRowEditor({ code, row, trips }: { code: string; row: CodeRow; trips: TripRow[] }) {
  const upsert = useMutation(api.management.upsertAccessCode);
  const del = useMutation(api.management.deleteAccessCode);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function updateTrips(tripIds: string[]) {
    setBusy(true);
    try {
      await upsert({ code, id: row._id as any, targetCode: row.code, tripIds: tripIds as any, label: row.label, active: row.active });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await upsert({ code, id: row._id as any, targetCode: row.code, tripIds: row.tripIds as any, label: row.label, active: !row.active });
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
    <div className="card" style={{ opacity: busy ? 0.6 : 1 }}>
      <div className="ctop" style={{ marginBottom: 8, flexWrap: "wrap", rowGap: 8 }}>
        <span className="cmain" style={{ fontSize: 16 }}>
          {row.label || row.code}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" aria-pressed={row.active} onClick={toggleActive} disabled={busy}>
            {row.active ? "Active" : "Inactive"}
          </button>
          <button className="btn" onClick={remove} disabled={busy} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
            Delete
          </button>
        </span>
      </div>
      <div className="cmeta" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "monospace", letterSpacing: 1 }}>
          {revealed ? row.code : `${row.code.charAt(0)}${"•".repeat(8)}`}
        </span>
        <button
          className="btn"
          onClick={() => setRevealed((r) => !r)}
          disabled={busy}
          style={{ padding: "2px 10px", fontSize: 12 }}
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
      </div>
      <TripCheckboxes trips={trips} selected={row.tripIds} onChange={updateTrips} />
    </div>
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
