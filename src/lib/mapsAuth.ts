// When Google refuses the site's key (allowed websites, billing, quota) it calls
// window.gm_authFailure and covers every map with its own "This page can't load
// Google Maps correctly" box. We listen for it so the page can show its own note.
let authFailed = false;
const listeners = new Set<() => void>();

export function mapsAuthFailed(): boolean {
  return authFailed;
}

export function onMapsAuthFailure(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function watchMapsAuthFailure(onFail?: () => void): void {
  (window as unknown as Record<string, () => void>).gm_authFailure = () => {
    authFailed = true;
    onFail?.();
    listeners.forEach((cb) => cb());
  };
}
