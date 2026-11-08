import { diffLines, type Change } from "./changeDiff";

/** The visible text of a (sanitized) html string, so tags and links can't skew a diff. */
export function plainText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
}

/** Word-level diff: words and the spaces between them, marked same / new / gone. */
export function diffWords(prev: string, next: string): Change<string>[] {
  const tokens = (s: string) => s.split(/(\s+)/).filter(Boolean);
  return diffLines(tokens(prev), tokens(next), (t) => t);
}

export interface Run {
  text: string;
  changed: boolean;
}

/**
 * One side of a word diff as runs of text, `changed` where that side differs from
 * the other: the old side marks the words that were removed, the new side the
 * words that were added. A space between two changed words belongs to the run
 * ("fairly relaxed" is one run), and neighbours with the same flag are merged.
 */
export function diffRuns(prev: string, next: string, side: "old" | "new"): Run[] {
  const drop = side === "old" ? "new" : "gone";
  const tokens = diffWords(prev, next)
    .filter((c) => c.state !== drop)
    .map((c) => ({ text: c.item, changed: c.state !== "same" }));
  // Tokens alternate word / space. A space is part of a change only between two
  // changed words, so a run never starts or ends on one.
  const words = tokens.map((t) => t.changed);
  tokens.forEach((t, i) => {
    if (!t.text.trim()) t.changed = !!(words[i - 1] && words[i + 1]);
  });
  const runs: Run[] = [];
  for (const t of tokens) {
    const last = runs[runs.length - 1];
    if (last && last.changed === t.changed) last.text += t.text;
    else runs.push({ ...t });
  }
  return runs;
}
