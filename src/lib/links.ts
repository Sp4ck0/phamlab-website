// Finds bare URLs in plain text so itinerary text can make them clickable.
// Only http(s) links come out (www.… gets https://), matching SAFE_HREF in
// sanitizeHtml.ts — nothing here can produce a javascript: or data: href.
const URL_RE = /(?<![\w@])(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING = /[.,;:!?'"]$/;

export interface TextLink {
  start: number;
  end: number;
  href: string;
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

// Prose punctuation after a URL ("see https://x.com/a.") isn't part of it; a
// closing paren only is if the URL opened one ("…/Foo_(bar)").
function trimUrl(url: string) {
  for (;;) {
    if (TRAILING.test(url)) url = url.slice(0, -1);
    else if (url.endsWith(")") && count(url, ")") > count(url, "(")) url = url.slice(0, -1);
    else return url;
  }
}

export function findLinks(text: string): TextLink[] {
  const links: TextLink[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    // Just a scheme or "www." with nothing after it isn't a link.
    if (!/^(?:https?:\/\/|www\.)[^\s./]/i.test(url)) continue;
    const start = m.index;
    links.push({ start, end: start + url.length, href: /^www\./i.test(url) ? `https://${url}` : url });
  }
  return links;
}
