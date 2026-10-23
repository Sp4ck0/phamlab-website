import { Component, type ReactNode } from "react";

// A failed Convex query throws during render; without a boundary React
// unmounts the whole app into a blank page.
export class ErrorBoundary extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "var(--text-secondary)" }}>
        <p>{this.props.message}</p>
        <button className="btn" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }
}
