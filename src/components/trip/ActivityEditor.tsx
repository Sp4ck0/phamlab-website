import { useEffect, useRef, useState } from "react";

interface Props {
  initial: string;
  onSave: (text: string) => Promise<unknown>;
  onCancel: () => void;
}

// Inline editor for one activity's text. Opens with the cursor at the end so
// appending a note ("— Dec 5 sold out") is just type and save.
export function ActivityEditor({ initial, onSave, onCancel }: Props) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Grow with the text instead of scrolling inside a tiny box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  async function submit() {
    if (saving || !text.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave(text);
    } catch (e) {
      // Convex wraps server errors; the useful part is the last line.
      const msg = e instanceof Error ? e.message.split("\n").pop() ?? "" : "";
      setError(msg.replace(/^(Uncaught )?Error:\s*/, "") || "Couldn't save — try again.");
      setSaving(false);
    }
  }

  return (
    <form
      className="ai-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <textarea
        ref={ref}
        className="ai-input"
        aria-label="Activity text"
        rows={1}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="ai-editor-actions">
        {error && <span className="ai-error">{error}</span>}
        <button type="button" className="ai-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ai-btn ai-btn-primary" disabled={!text.trim() || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
