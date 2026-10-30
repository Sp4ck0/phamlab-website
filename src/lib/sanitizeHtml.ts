// Trip text (activities, callouts, conflicts) can carry a little inline markup,
// but it is edited out-of-band and, soon, through the MCP — so it is never
// trusted as HTML. Everything outside a tiny allowlist is flattened to its
// text, and links are limited to http(s)/mailto and forced to open safely.
const ALLOWED_TAGS = new Set(["A", "B", "I", "EM", "STRONG", "BR"]);
const SAFE_HREF = /^(https?:|mailto:)/i;

function clean(node: Node, out: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(child.textContent ?? ""));
      continue;
    }
    if (!(child instanceof Element)) continue;

    // Foreign (SVG/MathML) elements keep a lowercase tagName.
    const tag = child.tagName.toUpperCase();
    if (!ALLOWED_TAGS.has(tag) || child.namespaceURI !== "http://www.w3.org/1999/xhtml") {
      // Unknown element: keep its text, drop the tag (and scripts/styles whole).
      if (tag !== "SCRIPT" && tag !== "STYLE") clean(child, out);
      continue;
    }

    const el = document.createElement(child.tagName);
    if (child.tagName === "A") {
      const href = child.getAttribute("href")?.trim() ?? "";
      if (SAFE_HREF.test(href)) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
    clean(child, el);
    out.appendChild(el);
  }
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const wrapper = document.createElement("div");
  clean(doc.body, wrapper);
  return wrapper.innerHTML;
}
