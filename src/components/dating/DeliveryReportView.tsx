import { useEffect, useRef, useState } from "react";

// Compact delivery measurements for one spoken turn. Opaque here: the
// backend's transcribe action produces them and its summarizeDelivery action
// reads them back (phamlab convex/lib/deliveryTurn.ts owns the shape).
export type VoiceTurnMetrics = Record<string, unknown>;

// A spoken turn's measurements plus its recording, which stays in this tab's
// memory (never uploaded again or saved) so report examples can be replayed.
export interface VoiceTurn {
  metrics: VoiceTurnMetrics;
  audio: Blob;
}

type DeliveryLabel = "Strong" | "Developing" | "Needs attention" | "Insufficient data" | "Not graded";
type DeliverySource = "groq" | "timestamps" | "audio" | "text";
type PauseClass = "natural_boundary" | "likely_boundary" | "likely_hesitation" | "strong_hesitation";
type TimelineToken =
  | { kind: "word"; text: string; ms: number | null; filler: boolean; focus: boolean }
  | { kind: "pause"; ms: number; pauseClass: PauseClass; focus: boolean };

export interface DeliveryReport {
  overall: DeliveryLabel;
  takeaway: string;
  change: string;
  basis: { spokenTurns: number; typedTurns: number; spokenSeconds: number };
  sections: { id: string; title: string; label: DeliveryLabel; summary: string; why: string }[];
  // `turn` indexes the spoken turns in order; startMs–endMs is the example's
  // position in that turn's recording.
  examples: { title: string; text: string; why: string; turn: number; startMs: number; endMs: number; timeline: TimelineToken[] }[];
  metrics: { label: string; value: string; sources: DeliverySource[] }[];
}

const DELIVERY_LABEL_COLORS: Record<DeliveryLabel, [string, string]> = {
  Strong: ["var(--accent-3)", "var(--accent-3-tint)"],
  Developing: ["var(--accent-2)", "var(--accent-2-tint)"],
  "Needs attention": ["var(--danger)", "var(--danger-tint)"],
  "Insufficient data": ["var(--text-muted)", "var(--chip-bg)"],
  "Not graded": ["var(--text-muted)", "var(--chip-bg)"],
};

const PAUSE_STYLES: Record<PauseClass, { color: string; background: string; label: string }> = {
  natural_boundary: { color: "var(--text-muted)", background: "var(--chip-bg)", label: "natural pause" },
  likely_boundary: { color: "var(--text-muted)", background: "var(--chip-bg)", label: "natural pause" },
  likely_hesitation: { color: "var(--accent-2)", background: "var(--accent-2-tint)", label: "likely hesitation" },
  strong_hesitation: { color: "var(--danger)", background: "var(--danger-tint)", label: "strong hesitation" },
};

const METRIC_SOURCES: Record<DeliverySource, string> = {
  groq: "Groq transcript",
  timestamps: "Groq word timings",
  audio: "Audio analysis",
  text: "Transcript wording",
};

// Context played on each side of an example.
const PLAYBACK_PADDING_S = 0.5;

const seconds = (ms: number) => (ms < 50 ? "<0.1s" : `${(ms / 1000).toFixed(1)}s`);

function DeliveryLabelPill({ label }: { label: DeliveryLabel }) {
  const [color, background] = DELIVERY_LABEL_COLORS[label];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color, background, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// Word pills show how long each word was audible; pause pills (0.5 s or
// longer) are colored by how the pause was classified.
function DeliveryTimeline({ tokens }: { tokens: TimelineToken[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {tokens.map((t, i) =>
        t.kind === "word" ? (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 999,
              border: `1px ${t.filler ? "dashed" : "solid"} ${t.focus ? "var(--text-primary)" : "var(--border)"}`,
              background: "var(--card)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontStyle: t.filler ? "italic" : undefined,
              fontWeight: t.focus ? 700 : 400,
            }}
          >
            {t.text}
            {t.ms !== null && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>{seconds(t.ms)}</span>}
          </span>
        ) : (
          <span
            key={i}
            aria-label={`${seconds(t.ms)} pause, ${PAUSE_STYLES[t.pauseClass].label}`}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              color: PAUSE_STYLES[t.pauseClass].color,
              background: PAUSE_STYLES[t.pauseClass].background,
              border: `1.5px solid ${t.focus ? PAUSE_STYLES[t.pauseClass].color : "transparent"}`,
              whiteSpace: "nowrap",
            }}
          >
            pause {seconds(t.ms)}
          </span>
        )
      )}
    </div>
  );
}

// Plays a slice of a turn's recording. Decodes with Web Audio rather than an
// <audio> element: MediaRecorder's WebM files have no seek index, so jumping
// to the middle of one is unreliable.
function useClipPlayer(recordings: (Blob | undefined)[]) {
  const ctxRef = useRef<AudioContext | null>(null);
  const decoded = useRef(new Map<number, Promise<AudioBuffer>>());
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const latestRequest = useRef(0);
  const [playing, setPlaying] = useState<number | null>(null);

  useEffect(
    () => () => {
      sourceRef.current?.stop();
      void ctxRef.current?.close();
    },
    []
  );

  function stop() {
    const source = sourceRef.current;
    sourceRef.current = null;
    source?.stop();
    setPlaying(null);
  }

  async function play(id: number, turn: number, startMs: number, endMs: number) {
    stop();
    const blob = recordings[turn];
    if (!blob) return;
    const request = ++latestRequest.current;
    setPlaying(id);
    try {
      const ctx = ctxRef.current ?? (ctxRef.current = new AudioContext());
      if (ctx.state === "suspended") await ctx.resume();
      let buffer = decoded.current.get(turn);
      if (!buffer) {
        buffer = blob.arrayBuffer().then((bytes) => ctx.decodeAudioData(bytes));
        decoded.current.set(turn, buffer);
      }
      const audio = await buffer;
      // Another Play click while this one was decoding wins.
      if (request !== latestRequest.current) return;
      const from = Math.max(0, startMs / 1000 - PLAYBACK_PADDING_S);
      const to = Math.min(audio.duration, endMs / 1000 + PLAYBACK_PADDING_S);
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.connect(ctx.destination);
      source.onended = () => {
        if (sourceRef.current === source) stop();
      };
      sourceRef.current = source;
      source.start(0, from, Math.max(0, to - from));
    } catch {
      setPlaying(null);
    }
  }

  return { playing, play, stop };
}

export function DeliveryReportView({ report, recordings }: { report: DeliveryReport; recordings: (Blob | undefined)[] }) {
  const { spokenTurns, typedTurns, spokenSeconds } = report.basis;
  const { playing, play, stop } = useClipPlayer(recordings);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const canPlay = report.examples.some((e) => recordings[e.turn]);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="ctype">Confident delivery</span>
          <DeliveryLabelPill label={report.overall} />
        </div>
        <div className="cmain" style={{ margin: 0 }}>
          {report.takeaway}
        </div>
        <p className="sdek" style={{ margin: 0 }}>
          Based on {plural(spokenTurns, "spoken message")} ({spokenSeconds} s of speech)
          {typedTurns > 0 ? `; ${plural(typedTurns, "typed message")} ${typedTurns === 1 ? "wasn't" : "weren't"} analyzed` : ""}.
        </p>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {report.sections.map((s) => (
          <div key={s.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="ctype">{s.title}</span>
              <DeliveryLabelPill label={s.label} />
            </div>
            <p className="sdek" style={{ margin: 0 }}>
              {s.summary}
            </p>
          </div>
        ))}
      </div>

      <div>
        <div className="ctype" style={{ marginBottom: 6 }}>
          Highest-impact change
        </div>
        <p className="sdek" style={{ margin: 0, color: "var(--text-primary)", fontWeight: 600 }}>
          {report.change}
        </p>
      </div>

      <details className="card" style={{ padding: 12 }}>
        <summary className="ctype" style={{ cursor: "pointer" }}>
          Why these cues?
        </summary>
        <p className="sdek" style={{ margin: "10px 0 8px" }}>
          Research on how voices are perceived (Guyer et al., 2021, <em>Journal of Nonverbal Behavior</em>) finds that
          listeners tend to rate speakers as more confident when they pause less, speak louder, and end statements on a
          falling rather than rising pitch. This report measures those cues in your recordings. It describes how your
          delivery may come across, not how confident you actually feel, and its thresholds are practice guidelines rather
          than scientific cutoffs.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {report.sections.map((s) => (
            <li key={s.id} className="sdek" style={{ marginBottom: 6 }}>
              <strong>{s.title}:</strong> {s.why}
            </li>
          ))}
        </ul>
      </details>

      {report.examples.length > 0 && (
        <details className="card" style={{ padding: 12 }}>
          <summary className="ctype" style={{ cursor: "pointer" }}>
            Flagged examples
          </summary>
          <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
            {report.examples.map((e, i) => (
              <div
                key={i}
                style={{ display: "grid", gridTemplateColumns: canPlay ? "64px 1fr" : "1fr", gap: 12, alignItems: "start" }}
              >
                {canPlay && (
                  <div>
                    {recordings[e.turn] && (
                      <button
                        type="button"
                        className="btn"
                        style={{ width: "100%", padding: "4px 0" }}
                        onClick={() => (playing === i ? stop() : play(i, e.turn, e.startMs, e.endMs))}
                      >
                        {playing === i ? "Stop" : "Play"}
                      </button>
                    )}
                  </div>
                )}
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <span className="ctype">{e.title}</span>
                  {e.timeline.length > 0 ? (
                    <DeliveryTimeline tokens={e.timeline} />
                  ) : (
                    <p className="sdek" style={{ margin: 0, color: "var(--text-primary)" }}>
                      “{e.text}”
                    </p>
                  )}
                  <p className="sdek" style={{ margin: 0, opacity: 0.8 }}>
                    {e.why}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="sdek" style={{ margin: "12px 0 0", fontSize: 12 }}>
            Each word shows how long it was audible. Pauses of half a second or more are marked: gray is a natural break,
            orange a likely hesitation, red a strong one. Dashed words are fillers; bold marks what the example is about.
          </p>
        </details>
      )}

      <details className="card" style={{ padding: 12 }}>
        <summary className="ctype" style={{ cursor: "pointer" }}>
          Raw metrics
        </summary>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {report.metrics.map((m) => (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
              <div>
                <div>{m.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.sources.map((s) => METRIC_SOURCES[s]).join(" · ")}</div>
              </div>
              <div style={{ fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>{m.value}</div>
            </div>
          ))}
        </div>
        <p className="sdek" style={{ margin: "12px 0 0", fontSize: 12 }}>
          Groq transcript and word timings come from speech recognition; audio analysis is measured from your recording in
          your browser (volume and pitch), never compared with other people; transcript wording is pattern-matched in the
          text. Recordings stay in this browser tab only until you start over.
        </p>
      </details>
    </div>
  );
}
