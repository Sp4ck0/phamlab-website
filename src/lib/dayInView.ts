// The day the reader is looking at: the last day whose card top has reached `line` (just below
// the sticky date strip), given the cards in page order. None while the page is above the first day.
// Every card is checked: one that reports a position far down the page (a browser that has not laid
// a day out yet) is skipped, not taken as the end of the list, which sent the answer back to the first day.
export function dayAtLine(cards: { id: string; top: number }[], line: number): string | undefined {
  let at: string | undefined;
  for (const c of cards) {
    if (c.top <= line) at = c.id;
  }
  return at;
}
