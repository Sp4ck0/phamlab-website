import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";

// A trip's open note (notes.ts), shared by everyone with access to the trip.
// Typing never touches the server: edits live as a draft in this browser's
// localStorage and only reach Convex on save(). The draft remembers the server
// version it started from (`base`), so if someone else saves in the meantime
// the editor can say so instead of silently overwriting them.
type Draft = { body: string; base: number };

const key = (slug: string) => `phamlab.noteDraft.${slug}`;

// Storage can throw (private mode, blocked site data); a draft is then just
// in-memory until saved.
function loadDraft(slug: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(slug));
    const d = raw ? JSON.parse(raw) : null;
    return d && typeof d.body === "string" && typeof d.base === "number" ? d : null;
  } catch {
    return null;
  }
}

function storeDraft(slug: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(key(slug), JSON.stringify(draft));
    else localStorage.removeItem(key(slug));
  } catch {
    // ignore
  }
}

export function useTripNote(slug: string) {
  const { code } = useAccessCode();
  const server = useQuery(api.notes.getNote, slug ? { slug, code } : "skip");
  const saveMut = useMutation(api.notes.saveNote);
  const [draft, setDraftState] = useState<Draft | null>(() => loadDraft(slug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Another trip, another draft.
  useEffect(() => {
    setDraftState(loadDraft(slug));
    setError(null);
  }, [slug]);

  const setDraft = useCallback(
    (next: Draft | null) => {
      setDraftState(next);
      storeDraft(slug, next);
    },
    [slug]
  );

  const loaded = server !== undefined && server !== null;
  const serverBody = server?.body ?? "";
  const serverVersion = server?.updatedAt ?? 0;
  const dirty = loaded && draft !== null && draft.body !== serverBody;
  // Someone saved a different version after this draft was started.
  const conflict = dirty && draft.base !== serverVersion;

  // A draft that has become identical to what's saved is no draft at all.
  useEffect(() => {
    if (loaded && draft && draft.body === serverBody) setDraft(null);
  }, [loaded, draft, serverBody, setDraft]);

  const edit = (body: string) => setDraft({ body, base: draft?.base ?? serverVersion });

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveMut({ slug, code, body: draft.body, baseUpdatedAt: draft.base });
      if (res.ok) setDraft(null);
      // On a conflict the reactive query delivers their version, which flips
      // `conflict` on; nothing was written.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return {
    loaded,
    text: draft?.body ?? serverBody,
    saved: serverBody,
    dirty,
    conflict,
    saving,
    error,
    edit,
    save,
    discard: () => setDraft(null),
    // Keep my text and save over theirs (the next save is based on their version).
    keepMine: () => draft && setDraft({ ...draft, base: serverVersion }),
  };
}
