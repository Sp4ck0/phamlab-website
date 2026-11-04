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
