import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { PageShell } from "../components/layout/PageShell";
import { Markdown } from "../components/Markdown";
import { StarterPromptButton } from "../components/StarterPromptButton";
import { useAccessCode } from "../hooks/useAccessCode";
import type { GuideData } from "../lib/starterPrompt";
import { NotFoundOrDenied } from "./NotFoundOrDenied";
import "../styles/guide.css";

// What the site can do and how its AI connection works, in one place. Everything
// below the intro comes from the backend (convex/guide.ts), generated from the
// same tools and guide text the connection serves, so it can't drift.
export function GuidePage() {
  const { code } = useAccessCode();
  // undefined = loading, null = no grant.
  const data = useQuery(api.guide.getGuide, code ? { code } : {}) as GuideData | null | undefined;

  if (data === undefined) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }
  if (data === null) {
    return (
      <PageShell>
        <NotFoundOrDenied />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="guide">
        <h2 className="shead" style={{ marginTop: 0 }}>
          Guide
        </h2>
        <p className="sdek">
          What this site can do, and how to ask an AI assistant to do it without guessing. Connect an assistant under
          Settings, then start from the prompt below.
        </p>

        <div className="guide-actions">
          <StarterPromptButton />
          <StarterPromptButton full />
        </div>

        <h3>On the site</h3>
        <ul className="guide-blurb">
          <li>
            <strong>Trips.</strong> A day-by-day itinerary with flights and trains, hotels, activities, weather and a
            map. The <em>Action Items</em> list at the bottom collects what still needs doing: bookings marked
            needed, days with nothing planned, decisions and to-dos. Each can be ticked off and given a due date.
          </li>
          <li>
            <strong>Boards.</strong> A shared board of cards for things to talk through, with replies and per-card
            to-dos.
          </li>
          <li>
            <strong>AI connection.</strong> Give an assistant a token in Settings and it can read and, if you allow
            writing, edit trips and boards. It sees the same rules described below.
          </li>
        </ul>

        {data.guides.map((g, i) => (
          <details key={g.title} className="guide-section" open={i === 0}>
            <summary>{g.title}</summary>
            <Markdown source={g.markdown} />
          </details>
        ))}

        <details className="guide-section">
          <summary>Every function ({data.tools.length})</summary>
          <p className="sdek">
            What the AI connection can call. <span className="guide-tag">changes data</span> marks the ones that write;
            the rest only read.
          </p>
          {data.tools.map((t) => (
            <details key={t.name} className="guide-tool">
              <summary>
                <code>{t.name}</code>
                {t.write && <span className="guide-tag">changes data</span>}
                <span className="guide-title">{t.title}</span>
              </summary>
              <p>{t.description}</p>
              {t.params.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Type</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.params.map((p) => (
                      <tr key={p.name}>
                        <td>
                          <code>{p.name}</code>
                          {p.required && <span className="guide-req"> required</span>}
                        </td>
                        <td>{p.type}</td>
                        <td>{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="sdek">No parameters.</p>
              )}
            </details>
          ))}
        </details>
      </div>
    </PageShell>
  );
}
