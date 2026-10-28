// Renders nothing without a URL, so "no specific time → no button" is decided
// by the url builders in lib/calendar.ts and enforced in one place here.
export function AddToCalendar({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a className="gcal-btn" href={url} target="_blank" rel="noopener" aria-label="Add to Google Calendar" title="Add to Google Calendar">
      📅 Add
    </a>
  );
}
