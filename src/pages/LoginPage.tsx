import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { PageShell } from "../components/layout/PageShell";

export function LoginPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // No public /register page — this app is invite-only. The one-time
  // "create account" toggle exists purely so the owner can bootstrap their
  // own account once; everyone else gets access via a code, not an account.
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn("password", { email, password, flow: mode });
      navigate("/");
    } catch {
      setError(mode === "signIn" ? "Couldn't sign in — check your email and password." : "Couldn't create that account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <div style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px" }}>
        <h2 className="shead" style={{ marginTop: 0 }}>
          {mode === "signIn" ? "Log in" : "Create account"}
        </h2>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 14,
              fontFamily: "inherit",
              background: "var(--card)",
              color: "var(--text-primary)",
            }}
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{
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
            {submitting ? "Working…" : mode === "signIn" ? "Log in" : "Create account"}
          </button>
        </form>
        {error && (
          <p className="sdek" style={{ color: "var(--danger)", marginTop: 14 }}>
            {error}
          </p>
        )}
        <p className="sdek" style={{ marginTop: 28 }}>
          {mode === "signIn" ? (
            <>
              First time setting up the owner account?{" "}
              <button
                className="btn"
                style={{ padding: "2px 8px", fontSize: 10 }}
                onClick={() => setMode("signUp")}
                type="button"
              >
                Create it
              </button>
            </>
          ) : (
            <button className="btn" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => setMode("signIn")} type="button">
              Back to log in
            </button>
          )}
        </p>
        <p className="sdek" style={{ marginTop: 10 }}>
          Have a trip code instead? <Link to="/unlock" style={{ color: "var(--accent-1)" }}>Enter it here</Link>
        </p>
      </div>
    </PageShell>
  );
}
