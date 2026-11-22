export type ChangeState = "same" | "new" | "gone";
export interface Change<T> {
  item: T;
  state: ChangeState;
}

// Line diff of two lists by content key (longest common subsequence), so order
// is kept. An edited line shows as its old version ("gone") right above the new
// one ("new"). Items with the same key are "same".
export function diffLines<T>(prev: T[], next: T[], key: (item: T) => string): Change<T>[] {
  const a = prev.map(key);
  const b = next.map(key);
  // lcs[i][j] = length of the common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: Change<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ item: next[j], state: "same" });
      i++;
      j++;
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      out.push({ item: prev[i], state: "gone" });
      i++;
    } else {
      out.push({ item: next[j], state: "new" });
      j++;
    }
  }
  return out;
}

/** The class a diffed line carries (see .chg-new / .chg-gone in globals.css). */
export const changeClass = (state: ChangeState) => (state === "same" ? "" : ` chg-${state}`);

// An edited line comes out of diffLines as old rows ("gone") then new rows. Pair
// them in order so the new row can show the old wording's words in place
// (InlineDiff) instead of a separate struck-through ghost above it.
export function pairRewrites<T>(changes: Change<T>[]): (Change<T> & { prev?: T })[] {
  const out: (Change<T> & { prev?: T })[] = [];
  for (let i = 0; i < changes.length; ) {
    if (changes[i].state !== "gone") { out.push(changes[i++]); continue; }
    let g = i;
    while (g < changes.length && changes[g].state === "gone") g++;
    let n = g;
    while (n < changes.length && changes[n].state === "new") n++;
    const k = Math.min(g - i, n - g);
    out.push(...changes.slice(i, g - k));
    for (let j = 0; j < n - g; j++) out.push(j < k ? { ...changes[g + j], prev: changes[g - k + j].item } : changes[g + j]);
    i = n;
  }
  return out;
}
