const KEY = "phamlab.activeTab";
const tabId = crypto.randomUUID();

// With several tabs open, only the one used most recently should jump when the
// AI edits something. Tabs claim the slot when they gain focus; the others
// still receive the data, they just stay where they are.
export function claimActiveTab() {
  try {
    localStorage.setItem(KEY, tabId);
  } catch {
    // ignore
  }
}

export function releaseActiveTab() {
  try {
    if (localStorage.getItem(KEY) === tabId) localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// An unclaimed slot (the claiming tab closed) goes to whichever visible tab
// asks; without storage there is nobody to arbitrate, so every tab acts.
export function isActiveTab(): boolean {
  try {
    const claimed = localStorage.getItem(KEY);
    return claimed === tabId || (claimed === null && document.visibilityState === "visible");
  } catch {
    return true;
  }
}
