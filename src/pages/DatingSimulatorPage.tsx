import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/api";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";

interface PersonaRow {
  id: string;
  name: string;
  age: number;
  blurb: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Report {
  scores: {
    warmth: number;
    listening: number;
    play: number;
    clarity: number;
    curiosity: number;
    closing: number;
  };
  summary: string;
  strengths: string[];
  tryNext: string[];
}

const SCORE_LABELS: { key: keyof Report["scores"]; label: string }[] = [
  { key: "warmth", label: "Warmth" },
  { key: "listening", label: "Listening" },
  { key: "play", label: "Play" },
  { key: "clarity", label: "Clarity" },
  { key: "curiosity", label: "Curiosity" },
  { key: "closing", label: "Closing" },
];

export function DatingSimulatorPage() {
  const { code } = useAccessCode();
  const isAuthorized = useQuery(api.dating.checkDatingAccess, code ? { code } : "skip");

  if (isAuthorized === undefined) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }

  if (!isAuthorized) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0" }}>
          <h2 className="shead" style={{ marginTop: 0 }}>
            Not authorized
          </h2>
          <p className="sdek">
            This page is restricted. <Link to="/unlock" style={{ color: "var(--accent-1)" }}>Enter a code</Link>.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <DatingSimulator code={code!} />
    </PageShell>
  );
}

function DatingSimulator({ code }: { code: string }) {
  const [persona, setPersona] = useState<PersonaRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [report, setReport] = useState<Report | null>(null);

  function reset() {
    setPersona(null);
    setMessages([]);
    setReport(null);
  }

  if (!persona) {
    return <PersonaSelect code={code} onSelect={(p, opener) => { setPersona(p); setMessages([{ role: "assistant", content: opener }]); }} />;
  }

  if (report) {
    return <ReportView persona={persona} report={report} onRestart={reset} />;
  }

  return (
    <ChatScreen
      code={code}
      persona={persona}
      messages={messages}
      onMessagesChange={setMessages}
      onReport={setReport}
      onRestart={reset}
    />
  );
}

function PersonaSelect({
  code,
  onSelect,
}: {
  code: string;
  onSelect: (persona: PersonaRow, opener: string) => void;
}) {
  const personas = useQuery(api.dating.listPersonas, { code }) as PersonaRow[] | undefined;
  const chat = useAction(api.datingActions.chat);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(p: PersonaRow) {
    setStarting(p.id);
    setError(null);
    try {
      const { reply } = await chat({ code, personaId: p.id, history: [] });
      onSelect(p, reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the conversation.");
      setStarting(null);
    }
  }

  return (
    <div style={{ padding: "40px 0 0" }}>
      <h2 className="shead" style={{ marginTop: 0 }}>
        Dating Simulator
      </h2>
      <p className="sdek">
        Pick a partner, she talks first. Practice being warm, clear, curious. Hit End → Report anytime for instant
        feedback on Warmth / Listening / Play / Clarity / Curiosity / Closing.
      </p>
      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
      {personas === undefined && <p className="sdek">Loading…</p>}
      <div style={{ display: "grid", gap: 12, marginTop: 14, maxWidth: 560 }}>
        {personas?.map((p) => (
          <button
            key={p.id}
            type="button"
            className="card"
            disabled={starting !== null}
            onClick={() => pick(p)}
            style={{ textAlign: "left", cursor: "pointer", opacity: starting && starting !== p.id ? 0.5 : 1 }}
          >
            <div className="cmain" style={{ fontSize: 16 }}>
              {p.name}, {p.age}
            </div>
            <div className="sdek" style={{ margin: "4px 0 0" }}>
              {p.blurb}
            </div>
            {starting === p.id && <div className="sdek" style={{ marginTop: 6 }}>Starting…</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatScreen({
  code,
  persona,
  messages,
  onMessagesChange,
  onReport,
  onRestart,
}: {
  code: string;
  persona: PersonaRow;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onReport: (report: Report) => void;
  onRestart: () => void;
}) {
  const chat = useAction(api.datingActions.chat);
  const generateReport = useAction(api.datingActions.generateReport);
  const speak = useAction(api.datingActions.speak);
  const transcribe = useAction(api.datingActions.transcribe);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const spokenCountRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Speak any assistant message that arrived since we last spoke — covers
  // both her opening line and every subsequent reply, without replaying on
  // unrelated re-renders. Web Audio API (decode + BufferSource) instead of
  // <audio src=blob:> — the latter can silently stall at readyState
  // HAVE_NOTHING for some responses; decodeAudioData is far more reliable.
  useEffect(() => {
    if (!voiceOn) return;
    const idx = messages.length - 1;
    if (idx < spokenCountRef.current) return;
    const last = messages[idx];
    if (!last || last.role !== "assistant") return;
    spokenCountRef.current = idx + 1;
    (async () => {
      try {
        const bytes = await speak({ code, personaId: persona.id, text: last.content });
        const ctx = audioCtxRef.current ?? (audioCtxRef.current = new AudioContext());
        if (ctx.state === "suspended") await ctx.resume();
        const decoded = await ctx.decodeAudioData((bytes as ArrayBuffer).slice(0));
        currentSourceRef.current?.stop();
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        currentSourceRef.current = source;
        source.start();
      } catch {
        // Voice is an enhancement, not critical — fail silently.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceOn]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: trimmed }];
    onMessagesChange(next);
    setDraft("");
    setSending(true);
    try {
      const { reply } = await chat({ code, personaId: persona.id, history: next });
      onMessagesChange([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "She didn't reply — try again.");
    } finally {
      setSending(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          const { text } = await transcribe({ code, audio: buf });
          if (text) await sendMessage(text);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't transcribe that.");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    await sendMessage(draft);
  }

  async function endAndGrade() {
    setGrading(true);
    setError(null);
    try {
      const result = await generateReport({ code, personaId: persona.id, transcript: messages });
      onReport(result as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the report.");
      setGrading(false);
    }
  }

  return (
    <div style={{ padding: "40px 0 0", display: "grid", gap: 12, maxWidth: 640, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="shead" style={{ margin: 0 }}>
          {persona.name}, {persona.age}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onRestart} disabled={grading}>
            Start over
          </button>
          <button className="btn" onClick={endAndGrade} disabled={grading || messages.length === 0}>
            {grading ? "Grading…" : "End → Report"}
          </button>
        </div>
      </div>

      <div style={{ position: "fixed", right: 24, bottom: 24, display: "flex", flexDirection: "column", gap: 10, zIndex: 10 }}>
        <button
          type="button"
          className="btn"
          aria-pressed={recording}
          onClick={toggleRecording}
          disabled={sending || grading || transcribing}
          title={recording ? "Stop recording" : "Speak your message"}
          style={{
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...(recording ? { color: "var(--danger)", borderColor: "var(--danger)" } : {}),
          }}
        >
          {recording ? <IconStop /> : transcribing ? "…" : <IconMic />}
        </button>
        <button
          className="btn"
          aria-pressed={voiceOn}
          onClick={() => setVoiceOn((v) => !v)}
          title={voiceOn ? "Turn her voice off" : "Turn her voice on"}
          style={{ borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {voiceOn ? <IconVolume2 /> : <IconVolumeX />}
        </button>
      </div>

      <div
        ref={listRef}
        className="card"
        style={{ height: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={bubbleStyle(m.role)}>{m.content}</div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={bubbleStyle("assistant")}>…</div>
          </div>
        )}
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          style={inputStyle}
          disabled={sending || grading}
        />
        <button className="btn" type="submit" disabled={sending || grading || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

function ReportView({ persona, report, onRestart }: { persona: PersonaRow; report: Report; onRestart: () => void }) {
  return (
    <div style={{ padding: "40px 0 0", maxWidth: 560 }}>
      <h2 className="shead" style={{ marginTop: 0 }}>
        Date report — {persona.name}
      </h2>
      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        {SCORE_LABELS.map(({ key, label }) => (
          <div key={key} style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="ctype">{label}</span>
              <span>{report.scores[key]}/10</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(10, report.scores[key])) * 10}%`,
                  background: "var(--accent-1)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="sdek">{report.summary}</p>

      <div style={{ display: "grid", gap: 16, marginTop: 8 }}>
        <div>
          <div className="ctype" style={{ marginBottom: 6 }}>
            Strengths
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {report.strengths.map((s, i) => (
              <li key={i} className="sdek">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="ctype" style={{ marginBottom: 6 }}>
            Try next time
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {report.tryNext.map((s, i) => (
              <li key={i} className="sdek">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button className="btn" onClick={onRestart} style={{ marginTop: 20 }}>
        Start over
      </button>
    </div>
  );
}

function IconVolume2({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function IconVolumeX({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

function IconMic({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function IconStop({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function bubbleStyle(role: ChatMessage["role"]): CSSProperties {
  return {
    maxWidth: "75%",
    padding: "8px 12px",
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.4,
    background: role === "user" ? "var(--accent-1)" : "var(--page)",
    color: role === "user" ? "#fff" : "var(--text-primary)",
    border: role === "user" ? "none" : "1px solid var(--border)",
  };
}

const inputStyle: CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--page)",
  color: "var(--text-primary)",
};
