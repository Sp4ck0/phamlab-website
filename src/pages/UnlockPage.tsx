import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { PageShell } from "../components/layout/PageShell";

export function UnlockPage() {
  const navigate = useNavigate();
  const { set } = useAccessCode();
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A mutation (not a reactive query) so submitting a code notifies Slack
  // exactly once per attempt, instead of re-running on every render.
  const attemptAccessCode = useMutation(api.trips.attemptAccessCode);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const code = input.trim();
    const result = await attemptAccessCode({ code });
    setSubmitting(false);
    if (!result.valid) {
      setError("That code didn't unlock anything — double check it and try again.");
      return;
    }
    set(code);
    if (result.trips.length > 0) {
      navigate(`/trip/${result.trips[0].slug}`);
    } else if (result.hasDatingAccess) {
      navigate("/dating-simulator");
    } else if (result.hasBoards) {
      navigate("/kanban");
    }
  }

  return (
    <PageShell>
      <div style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px" }}>
        <h2 className="shead" style={{ marginTop: 0 }}>
          Have a trip code?
        </h2>
        <p className="sdek">Enter it below to unlock the trips it covers.</p>
        <form onSubmit={submit} style={{ display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Access code"
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 14,
              fontFamily: "inherit",
              background: "var(--card)",
              color: "var(--text-primary)",
            }}
          />
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </form>
        {error && (
          <p className="sdek" style={{ color: "var(--danger)", marginTop: 14 }}>
            {error}
          </p>
        )}
        <p className="sdek" style={{ marginTop: 28 }}>
          Have an account instead? <Link to="/login" style={{ color: "var(--accent-1)" }}>Log in</Link>
        </p>
      </div>
    </PageShell>
  );
}
