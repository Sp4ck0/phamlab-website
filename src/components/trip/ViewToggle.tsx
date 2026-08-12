export type TripView = "overview" | "detailed";

export function ViewToggle({ view, onChange }: { view: TripView; onChange: (v: TripView) => void }) {
  return (
    <div className="view-toggle">
      <button type="button" className={view === "overview" ? "active" : ""} onClick={() => onChange("overview")}>
        Overview
      </button>
      <button type="button" className={view === "detailed" ? "active" : ""} onClick={() => onChange("detailed")}>
        Detailed
      </button>
    </div>
  );
}
