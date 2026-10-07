import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";

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
  examples: {
    title: string;
    text: string;
    why: string;
    section: "pace" | "presence" | "intonation" | "wording"; // the card it illustrates
    turn: number;
    startMs: number;
    endMs: number;
    timeline: TimelineToken[];
  }[];
  highlights: number[]; // examples shown with the takeaway, as its evidence
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

// Each recording is decoded once, in the browser, for both its waveform and
// playback. Keyed by the Blob itself so re-renders never decode twice.
const decodedAudio = new WeakMap<Blob, AudioBuffer>();
const pendingDecodes = new WeakMap<Blob, Promise<AudioBuffer>>();

function decode(blob: Blob): Promise<AudioBuffer> {
  let pending = pendingDecodes.get(blob);
  if (!pending) {
    pending = blob
      .arrayBuffer()
      .then((bytes) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes))
      .then((buffer) => {
        decodedAudio.set(blob, buffer);
        return buffer;
      });
    pendingDecodes.set(blob, pending);
  }
  return pending;
}

function useDecodedRecordings(blobs: (Blob | undefined)[]): (blob: Blob | undefined) => AudioBuffer | undefined {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    for (const blob of blobs) {
      if (blob && !decodedAudio.has(blob)) {
        decode(blob).then(
          () => mounted.current && rerender(),
          () => {} // undecodable: the example simply has no waveform or Play
        );
      }
    }
  });
  return (blob) => (blob ? decodedAudio.get(blob) : undefined);
}

// Plays part of a decoded recording and reports the playhead. Web Audio
// rather than <audio>: MediaRecorder's WebM files have no seek index, so
// jumping to the middle of one is unreliable.
function useClipPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const frameRef = useRef(0);
  const positionRef = useRef(0);
  const latestRequest = useRef(0);
  const [playing, setPlaying] = useState<{ id: number; at: number } | null>(null);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      sourceRef.current?.stop();
      void ctxRef.current?.close();
    },
    []
  );

  /** Stops playback and returns where the playhead was, in seconds. */
  function stop(): number {
    latestRequest.current++;
    cancelAnimationFrame(frameRef.current);
    const source = sourceRef.current;
    sourceRef.current = null;
    source?.stop();
    setPlaying(null);
    return positionRef.current;
  }

  async function play(id: number, buffer: AudioBuffer, from: number, to: number, onEnded: () => void) {
    stop();
    const request = latestRequest.current;
    const ctx = ctxRef.current ?? (ctxRef.current = new AudioContext());
    if (ctx.state === "suspended") await ctx.resume();
    if (request !== latestRequest.current) return; // another Play/Pause won meanwhile
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      if (sourceRef.current !== source) return;
      stop();
      onEnded();
    };
    sourceRef.current = source;
    const startedAt = ctx.currentTime;
    source.start(0, from, Math.max(0, to - from));
    const tick = () => {
      positionRef.current = Math.min(to, from + ctx.currentTime - startedAt);
      setPlaying({ id, at: positionRef.current });
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  return { playing, play, stop };
}

const WAVEFORM_BARS = 120;

// Peak amplitude per bar, normalized to the clip's loudest bar so quiet
// recordings are still readable (relative shape, not absolute volume).
function clipPeaks(buffer: AudioBuffer, from: number, to: number): number[] {
  const data = buffer.getChannelData(0);
  const start = Math.floor(from * buffer.sampleRate);
  const end = Math.min(data.length, Math.ceil(to * buffer.sampleRate));
  const step = Math.max(1, (end - start) / WAVEFORM_BARS);
  const peaks = Array.from({ length: WAVEFORM_BARS }, (_, bar) => {
    let peak = 0;
    for (let i = Math.floor(start + bar * step); i < Math.min(end, start + (bar + 1) * step); i++) peak = Math.max(peak, Math.abs(data[i]));
    return peak;
  });
  const loudest = Math.max(...peaks) || 1;
  return peaks.map((p) => p / loudest);
}

function Waveform({
  buffer,
  from,
  to,
  at,
  onScrub,
  onScrubEnd,
}: {
  buffer: AudioBuffer;
  from: number;
  to: number;
  at: number;
  onScrub: (seconds: number) => void;
  onScrubEnd: () => void;
}) {
  // useId() can contain characters that break url(#…) references.
  const clipId = `waveform${useId().replace(/[^\w-]/g, "")}`;
  // Bars are drawn once; playback only moves the clip over the played copy.
  const bars = useMemo(
    () =>
      clipPeaks(buffer, from, to).map((p, i) => {
        const h = Math.max(1, p * 34);
        return <rect key={i} x={i + 0.15} y={18 - h / 2} width={0.7} height={h} />;
      }),
    [buffer, from, to]
  );
  const played = Math.min(1, Math.max(0, (at - from) / Math.max(0.001, to - from)));
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ position: "relative", height: 36 }}>
        <svg viewBox={`0 0 ${WAVEFORM_BARS} 36`} preserveAspectRatio="none" width="100%" height="36" aria-hidden="true">
          <clipPath id={clipId}>
            <rect x={0} y={0} width={played * WAVEFORM_BARS} height={36} />
          </clipPath>
          <g fill="var(--text-muted)" opacity={0.45}>
            {bars}
          </g>
          <g fill="var(--accent-1)" clipPath={`url(#${clipId})`}>
            {bars}
          </g>
          <line
            x1={played * WAVEFORM_BARS}
            x2={played * WAVEFORM_BARS}
            y1={0}
            y2={36}
            stroke="var(--text-primary)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* A transparent native slider on top: click/drag/arrow keys to scrub. */}
        <input
          type="range"
          min={from}
          max={to}
          step={0.01}
          value={at}
          aria-label="Scrub through this example"
          aria-valuetext={`${(at - from).toFixed(1)} of ${(to - from).toFixed(1)} seconds`}
          onChange={(e) => onScrub(Number(e.target.value))}
          onPointerUp={onScrubEnd}
          onKeyUp={onScrubEnd}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer" }}
        />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
        {(at - from).toFixed(1)}s / {(to - from).toFixed(1)}s
      </div>
    </div>
  );
}

export function DeliveryReportView({ report, recordings }: { report: DeliveryReport; recordings: (Blob | undefined)[] }) {
  const { spokenTurns, typedTurns, spokenSeconds } = report.basis;
  const decoded = useDecodedRecordings(report.examples.map((e) => recordings[e.turn]));
  const { playing, play, stop } = useClipPlayer();
  // Paused/scrubbed playhead per example, in seconds into its recording.
  const [cursors, setCursors] = useState<Record<number, number>>({});
  const resumeAfterScrub = useRef<number | null>(null);
  const clip = (e: DeliveryReport["examples"][number]) => {
    const buffer = decoded(recordings[e.turn]);
    if (!buffer) return null;
    const from = Math.max(0, e.startMs / 1000 - PLAYBACK_PADDING_S);
    return { buffer, from, to: Math.min(buffer.duration, e.endMs / 1000 + PLAYBACK_PADDING_S) };
  };
  const startPlayback = (i: number, c: NonNullable<ReturnType<typeof clip>>, at: number) =>
    play(i, c.buffer, at >= c.to - 0.05 ? c.from : at, c.to, () => setCursors((all) => ({ ...all, [i]: c.from })));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const canPlay = report.examples.some((e) => recordings[e.turn]);
  // One renderer for every place an example appears (top card, its section,
  // Flagged examples). Player state is keyed by example index, so copies of
  // the same example play, pause, and scrub together.
  const renderExample = (i: number, key: string) => {
    const e = report.examples[i];
    const c = clip(e);
    const isPlaying = playing?.id === i;
    const at = isPlaying ? playing.at : (cursors[i] ?? c?.from ?? 0);
    return (
      <div key={key} style={{ display: "grid", gridTemplateColumns: canPlay ? "64px 1fr" : "1fr", gap: 12, alignItems: "start" }}>
        {canPlay && (
          <div>
            {recordings[e.turn] && (
              <button
                type="button"
                className="btn"
                disabled={!c}
                style={{ width: "100%", padding: "4px 0" }}
                onClick={() => {
                  if (!c) return;
                  if (isPlaying) setCursors((all) => ({ ...all, [i]: stop() }));
                  else void startPlayback(i, c, at);
                }}
              >
                {isPlaying ? "Pause" : "Play"}
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
          {c && (
            <Waveform
              buffer={c.buffer}
              from={c.from}
              to={c.to}
              at={at}
              onScrub={(seconds) => {
                // Dragging while playing pauses; letting go resumes from there.
                if (isPlaying) {
                  stop();
                  resumeAfterScrub.current = i;
                }
                setCursors((all) => ({ ...all, [i]: seconds }));
              }}
              onScrubEnd={() => {
                if (resumeAfterScrub.current !== i) return;
                resumeAfterScrub.current = null;
                void startPlayback(i, c, cursors[i] ?? c.from);
              }}
            />
          )}
          <p className="sdek" style={{ margin: 0, opacity: 0.8 }}>
            {e.why}
          </p>
        </div>
      </div>
    );
  };
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
        {report.highlights.length > 0 && (
          <div style={{ display: "grid", gap: 14, marginTop: 6 }}>{report.highlights.map((i) => renderExample(i, `top-${i}`))}</div>
        )}
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
            {report.examples.some((e) => e.section === s.id) && (
              <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
                {report.examples.flatMap((e, i) => (e.section === s.id ? [renderExample(i, `${s.id}-${i}`)] : []))}
              </div>
            )}
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
            {report.examples.map((_, i) => renderExample(i, `flagged-${i}`))}
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
