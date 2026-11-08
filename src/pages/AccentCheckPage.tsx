import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/api";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";
import { useRememberTab } from "../hooks/useRememberTab";
import { IconMic, IconStop } from "./DatingSimulatorPage";

interface AccentResult {
  accent: string;
  confidence: "low" | "medium" | "high";
  alternatives: { accent: string; why: string }[];
  clues: { word: string; expected: string; heard: string; feature: string; explanation: string }[];
  summary: string;
  caveats: string;
}

// The backend caps audio at ~90 s of 16 kHz mono WAV; stop a little before.
const MAX_RECORD_MS = 75_000;

// webm (what MediaRecorder gives us) -> 16 kHz mono 16-bit WAV, which Gemini
// accepts and which keeps the upload small.
async function toWav16k(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  void ctx.close();
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  out.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVEfmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, 1, true); // mono
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  str(36, "data");
  out.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return out.buffer;
}

export function AccentCheckPage() {
  const { code } = useAccessCode();
  const isAuthorized = useQuery(api.dating.checkDatingAccess, code ? { code } : "skip");
  useRememberTab(isAuthorized ? "/accent-check" : null);

  if (code && isAuthorized === undefined) {
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
      <AccentCheck code={code!} />
    </PageShell>
  );
}

function AccentCheck({ code }: { code: string }) {
  const passage = useQuery(api.dating.getAccentPassage, { code });
  const detectAccent = useAction(api.datingActions.detectAccent);
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AccentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | undefined>(undefined);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
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
        window.clearTimeout(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setAnalyzing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const audio = await toWav16k(blob);
          setResult(await detectAccent({ code, audio }));
        } catch (err) {
          // Production redacts plain Error messages; ConvexError carries ours.
          setError(
            err instanceof ConvexError && typeof err.data === "string"
              ? err.data
              : "Couldn't analyze that recording. Try again."
          );
        } finally {
          setAnalyzing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      timerRef.current = window.setTimeout(() => recorder.stop(), MAX_RECORD_MS);
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }

  return (
    <div style={{ padding: "40px 0 0", maxWidth: 640, display: "grid", gap: 16 }}>
      <div>
        <h2 className="shead" style={{ marginTop: 0 }}>Accent Check</h2>
        <p className="sdek">Read the passage out loud at a natural pace. We'll guess your accent and show what gave it away.</p>
      </div>

      {result ? (
        <ResultView result={result} onReset={() => setResult(null)} />
      ) : (
        <>
          <div className="card" style={{ cursor: "default" }}>
            <div className="ctype">Read this aloud</div>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: "8px 0 0" }}>{passage ?? "Loading…"}</p>
          </div>
          <div>
            <button
              type="button"
              className="btn"
              onClick={toggleRecording}
              disabled={analyzing || !passage}
              style={
                recording
                  ? { color: "var(--danger)", borderColor: "var(--danger)", background: "var(--danger-tint)" }
                  : undefined
              }
            >
              {recording ? <IconStop size={14} /> : <IconMic size={14} />}{" "}
              {analyzing ? "Listening closely…" : recording ? "Stop & analyze" : "Start recording"}
            </button>
          </div>
        </>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
    </div>
  );
}

function ResultView({ result, onReset }: { result: AccentResult; onReset: () => void }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ cursor: "default" }}>
        <div className="ctype">Likely accent · {result.confidence} confidence</div>
        <div className="cmain" style={{ fontSize: 20 }}>{result.accent}</div>
        <p className="sdek" style={{ margin: "8px 0 0" }}>{result.summary}</p>
      </div>

      <div>
        <h3 className="shead" style={{ fontSize: 16 }}>What gave it away</h3>
        {result.clues.length === 0 && <p className="sdek">No specific features stood out.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {result.clues.map((c, i) => (
            <div key={i} className="card" style={{ cursor: "default" }}>
              <div className="cmain">
                “{c.word}” <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/{c.expected}/ → /{c.heard}/</span>
              </div>
              <div className="ctype">{c.feature}</div>
              <p className="sdek" style={{ margin: "4px 0 0" }}>{c.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      {result.alternatives.length > 0 && (
        <div>
          <h3 className="shead" style={{ fontSize: 16 }}>Could also be</h3>
          {result.alternatives.map((a, i) => (
            <p key={i} className="sdek" style={{ margin: "4px 0" }}>
              <strong>{a.accent}</strong> — {a.why}
            </p>
          ))}
        </div>
      )}

      {result.caveats && <p className="sdek" style={{ fontStyle: "italic" }}>{result.caveats}</p>}
      <div>
        <button type="button" className="btn" onClick={onReset}>Try again</button>
      </div>
    </div>
  );
}
