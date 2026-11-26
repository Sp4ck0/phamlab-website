/** How long after a card opens a text box that takes focus on its own is given it back. */
export const OPEN_GUARD_MS = 600;
/** How far a finger moves on the pane before it counts as scrolling. */
const SCROLL_SLOP_PX = 10;

const isTextBox = (el: unknown): el is HTMLElement =>
  el instanceof HTMLElement && el.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=file])');

/**
 * Keeps the phone keyboard out of the way in a side pane (the card drawer):
 * - Just after it opens, a text box that gets focus without a touch or key
 *   inside the pane is blurred and the pane put back at its top. iOS can hand
 *   the opening tap to a box as the pane slides in, raising the keyboard and
 *   scrolling the top out of view.
 * - Dragging the pane while typing puts the keyboard away, as iPhone's own
 *   apps do, so the pane scrolls instead of iOS pulling it back to the box.
 *   A drag that starts in the box being typed in is left alone.
 * Returns a function that removes the listeners.
 */
export function guardPaneKeyboard(pane: HTMLElement): () => void {
  const win = pane.ownerDocument.defaultView ?? window;
  let acted = false;
  let opening = true;
  const act = () => {
    acted = true;
  };
  const onFocus = (e: FocusEvent) => {
    if (!opening || acted || !isTextBox(e.target)) return;
    e.target.blur();
    pane.scrollTop = 0;
  };
  const timer = win.setTimeout(() => {
    opening = false;
  }, OPEN_GUARD_MS);

  let start: { y: number; inField: boolean } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    const active = pane.ownerDocument.activeElement;
    start = {
      y: e.touches[0]?.clientY ?? 0,
      inField: isTextBox(active) && e.target instanceof Node && active.contains(e.target),
    };
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!start || start.inField) return;
    const active = pane.ownerDocument.activeElement;
    if (!isTextBox(active) || !pane.contains(active)) return;
    if (Math.abs((e.touches[0]?.clientY ?? start.y) - start.y) > SCROLL_SLOP_PX) active.blur();
  };
  const onTouchEnd = () => {
    start = null;
  };

  pane.addEventListener('pointerdown', act);
  win.addEventListener('keydown', act);
  pane.addEventListener('focusin', onFocus);
  pane.addEventListener('touchstart', onTouchStart, { passive: true });
  pane.addEventListener('touchmove', onTouchMove, { passive: true });
  pane.addEventListener('touchend', onTouchEnd);
  pane.addEventListener('touchcancel', onTouchEnd);
  return () => {
    win.clearTimeout(timer);
    pane.removeEventListener('pointerdown', act);
    win.removeEventListener('keydown', act);
    pane.removeEventListener('focusin', onFocus);
    pane.removeEventListener('touchstart', onTouchStart);
    pane.removeEventListener('touchmove', onTouchMove);
    pane.removeEventListener('touchend', onTouchEnd);
    pane.removeEventListener('touchcancel', onTouchEnd);
  };
}
