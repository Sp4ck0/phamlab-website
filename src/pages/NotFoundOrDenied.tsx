import { Link } from "react-router-dom";

// Shown for both "trip doesn't exist" and "you don't have access" —
// deliberately the same UI either way, so a denied visitor can't tell
// which one it was (no slug-enumeration leak).
export function NotFoundOrDenied() {
  return (
    <div style={{ padding: "80px 0" }}>
      <h2 className="shead">Not found</h2>
      <p className="sdek">
        Either this trip doesn't exist, or you don't have access to it yet.{" "}
        <Link to="/unlock" style={{ color: "var(--accent-1)" }}>
          Enter a code or log in
        </Link>{" "}
        to unlock it.
      </p>
    </div>
  );
}
