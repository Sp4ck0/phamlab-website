import { useEffect, useState } from "react";

// A booking reference, hidden until tapped so it isn't on screen by default;
// a second tap copies it.
export function ConfirmationChip({ code }: { code: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const onClick = async () => {
    if (!shown) {
      setShown(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard blocked: the code is on screen to read.
    }
  };

  return (
    <button
      type="button"
      className="conf-chip"
      onClick={onClick}
      aria-label={shown ? `Confirmation ${code}. Tap to copy.` : "Show confirmation code"}
      title={shown ? "Tap to copy" : "Show confirmation code"}
    >
      <span className="conf-label">Conf</span>
      <span className="conf-code">{copied ? "Copied" : shown ? code : "••••••"}</span>
    </button>
  );
}
