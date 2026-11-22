// Where the app should go when a tapped notification hands it a link while it is open.
// The site routes by "#", so the answer is a hash, or null to stay put (not our site).
// Tapping the same link twice would set the hash it already has, which does nothing,
// so the page wouldn't scroll to the day, activity or task again: then a timestamp is
// added, which makes it a new visit to the same place.
export function hashToOpen(url: string, origin: string, currentHash: string, now = Date.now()): string | null {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return null;
  }
  if (target.origin !== origin || !target.hash) return null;
  const want = withoutAt(target.hash);
  if (want !== withoutAt(currentHash)) return want;
  return `${want}${want.includes("?") ? "&" : "?"}at=${now}`;
}

// A hash without the ?at= of an earlier repeat tap.
function withoutAt(hash: string): string {
  const q = hash.indexOf("?");
  if (q < 0) return hash;
  const params = new URLSearchParams(hash.slice(q + 1));
  params.delete("at");
  const rest = params.toString();
  return rest ? `${hash.slice(0, q)}?${rest}` : hash.slice(0, q);
}
