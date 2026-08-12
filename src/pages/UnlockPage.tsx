import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { PageShell } from "../components/layout/PageShell";

export function UnlockPage() {
  const navigate = useNavigate();
  const { set } = useAccessCode();
  const [input, setInput] = useState("");
  const [pendingCode, setPendingCode] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Only fires once the user submits — verifies the code actually
  // resolves at least one trip before treating it as "unlocked".
  const result = useQuery(api.trips.listAccessibleTrips, pendingCode ? { code: pendingCode } : "skip");

  useEffect(() => {
    if (!pendingCode || result === undefined) return;
    if (result.length > 0) {
      set(pendingCode);
      navigate(`/trip/${result[0].slug}`);
    } else {
      setError("That code didn't unlock anything — double check it and try again.");
      setPendingCode(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCode, result]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendingCode(input.trim());
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
              border: "1px solid var(--rule)",
              borderRadius: 4,
              font: "500 14px Archivo",
              background: "var(--card)",
              color: "var(--ink)",
            }}
          />
          <button className="btn" type="submit">
            Unlock
          </button>
        </form>
        {error && (
          <p className="sdek" style={{ color: "var(--coral)", marginTop: 14 }}>
            {error}
          </p>
        )}
        <p className="sdek" style={{ marginTop: 28 }}>
          Have an account instead? <Link to="/login" style={{ color: "var(--sea)" }}>Log in</Link>
        </p>
      </div>
    </PageShell>
  );
}
