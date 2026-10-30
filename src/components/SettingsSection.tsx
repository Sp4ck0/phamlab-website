import type { ReactNode } from "react";

// A titled group of setting rows, drawn as one card so related rows read together.
export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3 className="settings-section__title">{title}</h3>
      {description && <p className="sdek settings-section__desc">{description}</p>}
      <div className="settings-card">{children}</div>
    </section>
  );
}
