// Which notification channel row belongs to this browser, so the list can tag
// it "This device" and removing it can also switch push off here. Per browser:
// the installed app and Safari keep separate storage, and separate pushes.
const KEY = "phamlab.pushChannelId";

export function readThisDeviceId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeThisDeviceId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: it still works, it just can't tag its row later */
  }
}

/** Drops this browser's push subscription and forgets its row. */
export async function unsubscribeThisDevice() {
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    await sub?.unsubscribe();
  } finally {
    writeThisDeviceId(null);
  }
}
