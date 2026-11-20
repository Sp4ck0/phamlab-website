// What can be subscribed to, by kind. The ids are the backend's registry
// (notificationTopics.ts); the wording is ours. A new kind is an entry here.
export type NotifyKind = "board" | "trip";

// `short` is the chip, `label` the board menu's checkbox, `help` what Settings'
// "What do these mean?" says about it (so the help can't drift from the chips).
export const TOPIC_EVENTS: Record<NotifyKind, { id: string; label: string; short: string; help: string }[]> = {
  board: [
    { id: "reply", label: "New replies", short: "Replies", help: "Someone replies on a card." },
    { id: "card_added", label: "New cards", short: "New cards", help: "Someone adds a card." },
    { id: "card_moved", label: "Cards moved between lanes", short: "Moved", help: "Someone moves a card to another lane." },
    { id: "card_changed", label: "Cards edited or removed", short: "Edited", help: "Someone edits or removes a card." },
  ],
  trip: [
    { id: "task_added", label: "New tasks and suggestions", short: "New tasks", help: "Someone adds a to-do or a suggestion." },
    {
      id: "task_done",
      label: "Tasks completed or decided",
      short: "Done",
      help: "Someone completes a task, or chooses or drops a suggestion.",
    },
    {
      id: "vote_cast",
      label: "Votes on suggestions",
      short: "Votes",
      help: "Someone casts or changes a yes/no vote on a suggestion. Repeating or clearing a vote doesn't count.",
    },
    { id: "note_changed", label: "Trip notes changed", short: "Notes", help: "Someone saves the trip's notes." },
    {
      id: "itinerary_changed",
      label: "Itinerary edits",
      short: "Itinerary",
      help: "Someone updates or removes a day, or edits an activity.",
    },
    {
      id: "reminder_due",
      label: "Daily reminder of tasks that are due",
      short: "Reminders",
      help: "A message at 9am in your time zone about tasks due today or tomorrow, or in the last 7 days. It counts due dates someone set, plus free-cancellation deadlines, and is sent once a day per trip.",
    },
  ],
};
