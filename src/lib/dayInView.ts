// The day the reader is looking at: the last day whose card top has reached `line` (just below
// the sticky date strip), given the cards in page order. None while the page is above the first day.
export function dayAtLine(cards: { id: string; top: number }[], line: number): string | undefined {
  let at: string | undefined;
  for (const c of cards) {
    if (c.top > line) break;
    at = c.id;
  }
  return at;
}
