// Share links: a URL that opens this trip at one day, tile or task (useShareLinkFocus reads it).
// It never carries the access code: whoever opens it needs their own access.

/** Copies a link that opens this trip at one day, tile or task (see ShareLinkButton); says whether it worked. */
export async function copyShareLink(slug: string | undefined, param: Record<string, string>): Promise<string> {
  const url = `${location.origin}${location.pathname}#/trip/${slug}?${new URLSearchParams(param)}`;
  try {
    await navigator.clipboard.writeText(url);
    return "Link copied";
  } catch {
    return "Couldn't copy";
  }
}
