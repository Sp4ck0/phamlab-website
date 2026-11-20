import { useReducer, useRef } from "react";

// Which tiles on a trip's timeline are open. A tile starts open or closed by its own
// rule (`defaultOpen`: unresolved ones open, settled ones closed); this only keeps what
// the reader changed.
//   - The reader's own toggles are saved per device (localStorage, `tiles:<slug>`).
//   - Under Only gaps the saved choices are ignored and toggles last only while that
//     view is on, so the view always starts with booked tiles closed and actionable ones open.
//   - A reveal (a shared link, an AI pointer, a search match) opens a tile for this visit
//     without saving anything, and never closes another tile.
// An id is unique across the trip (the day's date plus the tile's own key).
export interface TileOpen {
  isOpen(id: string, defaultOpen: boolean): boolean;
  toggle(id: string, defaultOpen: boolean): void;
  setMany(ids: string[], open: boolean): void;
  reveal(id: string): void;
}

type Choices = Record<string, boolean>;
const storageKey = (slug: string | undefined) => `tiles:${slug ?? ""}`;

function load(slug: string | undefined): Choices {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(slug)) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "boolean"));
  } catch {
    return {};
  }
}

function save(slug: string | undefined, choices: Choices) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(choices));
  } catch {
    // Private window or blocked storage: the choices just last for this visit.
  }
}

export function useTileOpen(slug: string | undefined, gapsView: boolean): TileOpen {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const saved = useRef<{ slug: string | undefined; choices: Choices } | null>(null);
  const gapsChoices = useRef<{ on: boolean; choices: Choices }>({ on: gapsView, choices: {} });
  const revealed = useRef<Set<string>>(new Set());

  if (saved.current === null || saved.current.slug !== slug) saved.current = { slug, choices: load(slug) };
  // Leaving or entering Only gaps starts that view's own choices afresh.
  if (gapsChoices.current.on !== gapsView) gapsChoices.current = { on: gapsView, choices: {} };

  const choices = () => (gapsView ? gapsChoices.current.choices : saved.current!.choices);
  const isOpen = (id: string, defaultOpen: boolean) => revealed.current.has(id) || (choices()[id] ?? defaultOpen);
  const set = (ids: string[], open: boolean) => {
    for (const id of ids) {
      revealed.current.delete(id);
      choices()[id] = open;
    }
    if (!gapsView) save(slug, saved.current!.choices);
    rerender();
  };
  return {
    isOpen,
    toggle: (id, defaultOpen) => set([id], !isOpen(id, defaultOpen)),
    setMany: set,
    reveal: (id) => {
      revealed.current.add(id);
      rerender();
    },
  };
}
