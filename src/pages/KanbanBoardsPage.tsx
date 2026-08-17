import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";
import { useKanbanBoards } from "../kanban/useKanbanBoards";

export function KanbanBoardsPage() {
  const { code } = useAccessCode();
  const { boards, isLoading, authorized } = useKanbanBoards();

  if (!code) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0" }}>
          <h2 className="shead">Boards</h2>
          <p className="sdek">
            Enter your access code to see your boards.{" "}
            <Link to="/unlock" style={{ color: "var(--accent-1)" }}>
              Enter a code or log in
            </Link>
            .
          </p>
        </div>
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }

  if (!authorized) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0" }}>
          <h2 className="shead">Not found</h2>
          <p className="sdek">
            That access code doesn't unlock any boards.{" "}
            <Link to="/unlock" style={{ color: "var(--accent-1)" }}>
              Try a different code
            </Link>
            .
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div style={{ padding: "48px 0" }}>
        <h2 className="shead">Boards</h2>
        {boards.length === 0 ? (
          <p className="sdek">No boards yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
            {boards.map((b) => (
              <Link
                key={b._id}
                to={`/kanban/${b._id}`}
                className="btn"
                style={{ justifyContent: "flex-start", textAlign: "left" }}
              >
                {b.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
