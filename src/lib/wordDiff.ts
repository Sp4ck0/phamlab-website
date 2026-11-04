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
