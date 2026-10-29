export type PersonId = 'a' | 'b';

/**
 * 'pair' is the original two-person board. 'features' is a feature-request
 * board for the site itself: any number of people, cards signed by name
 * rather than by the a/b seats, and its own lane/kind wording (BOARD_COPY).
 */
export type BoardType = 'pair' | 'features';

/**
 * The flavours of card. Colour and tone follow from this. A pair board offers
 * appreciation/feedback; a features board offers feature/appreciation.
 */
export type Kind = 'appreciation' | 'feedback' | 'feature';

/**
 * How much this weighs on the person who raised it — deliberately their call,
 * not a shared judgement about whether the thing "deserves" the rating.
 */
export type Weight = 'minor' | 'medium' | 'major';

export type LaneId = 'raised' | 'talking' | 'doing' | 'followup' | 'settled';

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
  /** Who took this on. null = nobody has claimed it yet. */
  owner: PersonId | null;
}

export interface Card {
  id: string;
  title: string;
  /** The longer version — context, what happened, how it landed. */
  note: string;
  kind: Kind;
  weight: Weight;
  /** Who raised it. */
  from: PersonId;
  /** Features boards only: name of whoever raised it (set by the server). */
  fromName?: string;
  /** Who it's about / who owns following through. null = both of us. */
  assignee: PersonId | null;
  actions: ActionItem[];
  /** ISO date (yyyy-mm-dd) to check back in. */
  followUp: string | null;
  createdAt: string;
  /** Free-form running notes, appended over time. */
  log: {
    id: string;
    at: string;
    by: PersonId;
    byName?: string;
    text: string;
    imageUrls?: KanbanImage[];
  }[];
  /** Images attached to the longer version. */
  noteImageUrls?: KanbanImage[];
}

/** An uploaded image: pixel size (to reserve its box before it loads) and a signed URL. */
export interface KanbanImage {
  id: string;
  w: number;
  h: number;
  url: string;
}

export interface Person {
  name: string;
}

export interface Board {
  version: 1;
  name: string;
  type: BoardType;
  people: Record<PersonId, Person>;
  /** Which person slot the current access code maps to, if any. */
  viewerPersonId: PersonId | null;
  /** Name on the current access code — signs notes on a features board. */
  viewerName: string;
  cards: Record<string, Card>;
  /** Ordered card ids per lane. This is the shape @dnd-kit/helpers `move` wants. */
  lanes: Record<LaneId, string[]>;
  /** Per-board lane wording set on the server; lanes left out use BOARD_COPY. */
  laneLabels?: Partial<Record<LaneId, { name: string; blurb?: string }>>;
  /** Per card id: replies from someone else the viewer hasn't read yet. Cards with none are absent. */
  unread: Record<string, number>;
  /** Ids of cards someone else raised that the viewer has never opened. */
  fresh: string[];
}

export const LANES: { id: LaneId; name: string; blurb: string }[] = [
  { id: 'raised', name: 'On the table', blurb: 'Said out loud. Not unpacked yet.' },
  { id: 'talking', name: 'Talking it through', blurb: 'We are in the middle of this one.' },
  { id: 'doing', name: 'We’re on it', blurb: 'Someone has taken something on.' },
  { id: 'followup', name: 'Checking back', blurb: 'Agreed — now let’s see if it held.' },
  { id: 'settled', name: 'Settled', blurb: 'Landed well. Kept here on purpose.' },
];

export const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'appreciation', label: 'Appreciation', hint: 'Something they did that landed well' },
  { id: 'feedback', label: 'Feedback', hint: 'Something you’d like to raise, ask for, or work through' },
];

/**
 * Ordered light → heavy. The labels are phrased from the raiser's side on purpose:
 * "how much this weighs on me" is not something the other person can argue with,
 * where "is this a major issue" very much is.
 */
export const WEIGHTS: { id: Weight; label: string; bars: number }[] = [
  { id: 'minor', label: 'Small', bars: 1 },
  { id: 'medium', label: 'Medium', bars: 2 },
  { id: 'major', label: 'Heavy', bars: 3 },
];

export const PEOPLE: PersonId[] = ['a', 'b'];

/** Everything that reads differently depending on what kind of board this is. */
export const BOARD_COPY: Record<
  BoardType,
  {
    lanes: typeof LANES;
    kinds: typeof KINDS;
    weights: typeof WEIGHTS;
    defaultKind: Kind;
    weightLabel: (raisedBy: string) => string;
    notePlaceholder: string;
    actionPlaceholder: string;
  }
> = {
  pair: {
    lanes: LANES,
    kinds: KINDS,
    weights: WEIGHTS,
    defaultKind: 'feedback',
    weightLabel: (raisedBy) => `How much it weighs on ${raisedBy}`,
    notePlaceholder: 'What happened, and how it landed…',
    actionPlaceholder: '+ something one of us will do',
  },
  features: {
    lanes: [
      { id: 'raised', name: 'New', blurb: 'Just posted. Not picked up yet.' },
      { id: 'talking', name: 'Planned', blurb: 'Agreed on. Waiting its turn.' },
      { id: 'doing', name: 'Building', blurb: 'Being worked on now.' },
      { id: 'followup', name: 'Try it out', blurb: 'Live — tell us if it works.' },
      { id: 'settled', name: 'Done', blurb: 'Shipped and working. Kudos live here too.' },
    ],
    kinds: [
      { id: 'feature', label: 'Feature', hint: 'Something you’d like added, changed, or fixed' },
      { id: 'appreciation', label: 'Appreciation', hint: 'Something that’s working well' },
    ],
    weights: [
      { id: 'minor', label: 'Low', bars: 1 },
      { id: 'medium', label: 'Medium', bars: 2 },
      { id: 'major', label: 'High', bars: 3 },
    ],
    defaultKind: 'feature',
    weightLabel: (raisedBy) => `How much it matters to ${raisedBy}`,
    notePlaceholder: 'What you’d like, and why it would help…',
    actionPlaceholder: '+ a step to get it done',
  },
};

/** Fields collected by the "+ write one" new-card pane. */
export interface QuickAddDraft {
  title: string;
  note: string;
  kind: Kind;
  weight: Weight;
}

/** A card being written in the new-card pane, including its target column. */
export interface NewCardDraft extends QuickAddDraft {
  lane: LaneId;
  /** Images to attach to the longer version once the card is created. */
  images: File[];
}
