import type { ReactNode } from "react";

// Just enough markdown for the backend's guide text: ## headings, "- " and "1. "
// lists (with indented continuation lines), paragraphs, `code` and **bold**.
// Nothing is ever treated as HTML, so the text can't inject markup.
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^(-|\d+\.)\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      flush();
    } else if (line.startsWith("# ")) {
      flush(); // the page supplies the title
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h", text: line.slice(3) });
    } else if (bullet) {
      flush();
      const kind = bullet[1] === "-" ? "ul" : "ol";
      if (last && last.kind === kind && !para.length) last.items.push(bullet[2]);
      else blocks.push({ kind, items: [bullet[2]] });
    } else if (/^\s+\S/.test(raw) && last && (last.kind === "ul" || last.kind === "ol") && !para.length) {
      last.items[last.items.length - 1] += " " + line.trim(); // continuation of the previous item
    } else {
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="md">
      {parse(source).map((b, i) => {
        if (b.kind === "h") return <h3 key={i}>{inline(b.text)}</h3>;
        if (b.kind === "p") return <p key={i}>{inline(b.text)}</p>;
        const Tag = b.kind;
        return (
          <Tag key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
