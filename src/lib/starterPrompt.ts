// Text for the Guide page's 🤖 buttons, built from the backend's guide query
// (convex/guide.ts), which is generated from the tools the AI connection really
// serves — so nothing here is written by hand that could drift from them.

export interface GuideParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface GuideTool {
  name: string;
  title: string;
  write: boolean;
  description: string;
  params: GuideParam[];
}

export interface GuideData {
  guides: { title: string; markdown: string }[];
  tools: GuideTool[];
}

// One "## Heading" section of a guide, heading included; "" when it isn't there.
export function section(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return "";
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join("\n").trim();
}

const RULES = [
  "Call whoami first. If the connection is read-only, do not try to change anything.",
  "Read before you write: list_trips, then get_trip or list_tasks. Never guess a slug, key or id.",
  "Make one logical change per call and tell me what you changed.",
  "Ask me before anything that deletes or replaces data (remove_day, remove_action_item, update_trip_meta, upsert_day on an existing date).",
  "If the reference below does not settle how something works, ask me instead of guessing.",
];

// A short prompt to start a conversation with an AI assistant that has the
// phamlab connection. The assistant already receives every tool's description
// and schema from the connection, so this carries only the working rules and
// the parts of the guide that are easy to get wrong — it is cheap to send.
export function buildStarterPrompt(data: GuideData, trip?: { slug: string; title: string }): string {
  const itinerary = data.guides[0]?.markdown ?? "";
  const reference = ["Workflow", "Tasks and action items", "How the Action Items list is built"]
    .map((h) => section(itinerary, h))
    .filter(Boolean)
    .join("\n\n");

  return [
    "I'm using our family travel site (phamlab) through its AI connection. Help me with the request at the bottom, and follow these rules:",
    RULES.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    trip ? `We're working on the trip "${trip.title}" (slug: ${trip.slug}).` : "",
    reference ? `Reference from the site's guide:\n\n${reference}` : "",
    "My request:\n",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const paramLine = (p: GuideParam) =>
  `    - ${p.name} (${p.type}${p.required ? ", required" : ""})${p.description ? `: ${p.description}` : ""}`;

// Everything: both guides and every tool with its parameters. For an assistant
// that does not have the connection (or to read yourself); long, so only on request.
export function buildFullReference(data: GuideData): string {
  const tools = data.tools
    .map((t) => [`- ${t.name} [${t.write ? "changes data" : "read-only"}]: ${t.description}`, ...t.params.map(paramLine)].join("\n"))
    .join("\n");
  return [
    ...data.guides.map((g) => `# ${g.title}\n\n${g.markdown.replace(/^# .*\n+/, "")}`),
    `# Tools\n\n${tools}`,
  ].join("\n\n");
}
