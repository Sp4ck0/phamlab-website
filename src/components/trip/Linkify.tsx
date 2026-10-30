import { Fragment } from "react";
import { findLinks } from "../../lib/links";

// Plain itinerary text with its bare URLs made clickable. Built as React
// elements, so the text itself is never treated as HTML.
export function Linkify({ text }: { text: string }) {
  const links = findLinks(text);
  if (links.length === 0) return <>{text}</>;
  const parts = [];
  let at = 0;
  links.forEach((l, i) => {
    if (l.start > at) parts.push(text.slice(at, l.start));
    parts.push(
      <a key={i} href={l.href} target="_blank" rel="noopener noreferrer">
        {text.slice(l.start, l.end)}
      </a>
    );
    at = l.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <Fragment>{parts}</Fragment>;
}
