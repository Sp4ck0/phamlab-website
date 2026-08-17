export type PersonId = 'a' | 'b';

/** The three flavours of feedback. Colour and tone follow from this. */
export type Kind = 'appreciation' | 'request' | 'friction';

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
  /** Who it's about / who owns following through. null = both of us. */
  assignee: PersonId | null;
  actions: ActionItem[];
  /** ISO date (yyyy-mm-dd) to check back in. */
  followUp: string | null;
  createdAt: string;
  /** Free-form running notes, appended over time. */
  log: { id: string; at: string; by: PersonId; text: string }[];
}

export interface Person {
  name: string;
}

export interface Board {
  version: 1;
  name: string;
  people: Record<PersonId, Person>;
  /** Which person slot the current access code maps to, if any. */
  viewerPersonId: PersonId | null;
  cards: Record<string, Card>;
  /** Ordered card ids per lane. This is the shape @dnd-kit/helpers `move` wants. */
  lanes: Record<LaneId, string[]>;
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
  { id: 'request', label: 'Request', hint: 'Something you’d like more or less of' },
  { id: 'friction', label: 'Friction', hint: 'Something that hurt or keeps recurring' },
];

/**
 * Ordered light → heavy. The labels are phrased from the raiser's side on purpose:
 * "how much this weighs on me" is not something the other person can argue with,
 * where "is this a major issue" very much is.
 */
export const WEIGHTS: { id: Weight; label: string; hint: string; bars: number }[] = [
  { id: 'minor', label: 'Small', hint: 'Worth saying once. I’m not carrying it around.', bars: 1 },
  { id: 'medium', label: 'Worth time', hint: 'I’d like us to actually sit down with this.', bars: 2 },
  { id: 'major', label: 'Heavy', hint: 'This one sits with me. I need it taken seriously.', bars: 3 },
];

export const PEOPLE: PersonId[] = ['a', 'b'];
