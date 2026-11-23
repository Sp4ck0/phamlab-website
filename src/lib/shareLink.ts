// Share links: a URL that opens this trip at one day, tile or task (useShareLinkFocus reads it).
// It never carries the access code: whoever opens it needs their own access.

/** Copies a link that opens this trip at one day, tile or task (see ShareLinkButton); says whether it worked. */
export const copyShareLink = (slug: string | undefined, param: Record<string, string>) =>
  copyHashLink(`/trip/${slug}?${new URLSearchParams(param)}`);

/**
 * Shares a link that opens this board with one card open (KanbanPage reads ?card=): the device's
 * share sheet where there is one, else copied to the clipboard. Returns a short status to show
 * ("" when there is nothing to say, e.g. the person closed the sheet).
 */
export async function shareCardLink(boardId: string, cardId: string, title: string): Promise<string> {
  const path = `/kanban/${boardId}?${new URLSearchParams({ card: cardId })}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url: hashUrl(path) });
      return "";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "";
      // Any other failure: fall back to copying.
    }
  }
  return copyHashLink(path);
}

const hashUrl = (path: string) => `${location.origin}${location.pathname}#${path}`;

async function copyHashLink(path: string): Promise<string> {
  const url = hashUrl(path);
  try {
    await navigator.clipboard.writeText(url);
    return "Link copied";
  } catch {
    return "Couldn't copy";
  }
}
