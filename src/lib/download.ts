import { toHtml, toMarkdown, type Itinerary } from "./itinerary";

function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(slug: string, it: Itinerary) {
  downloadText(`${slug}-itinerary.md`, toMarkdown(it), "text/markdown;charset=utf-8");
}

// Writes rich text (pastes formatted into Notes/Docs/Gmail) and Markdown
// (pastes as-is into Slack/GitHub/plain fields) in one clipboard item.
export async function copyItinerary(it: Itinerary) {
  const text = toMarkdown(it);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([toHtml(it)], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
  } else {
    await navigator.clipboard.writeText(text);
  }
}
