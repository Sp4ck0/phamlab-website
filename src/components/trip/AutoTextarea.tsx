import { useEffect, useRef, type Ref, type TextareaHTMLAttributes } from "react";

// A textarea that grows to fit its text, so long text is fully visible instead
// of scrolling inside a one-line box. Past its CSS max-height it stops growing
// and scrolls inside itself, so the wheel scrolls the text, not the page.
export function AutoTextarea({ ref, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    // border-box: the height includes the borders, which scrollHeight leaves out.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, [value]);

  return (
    <textarea
      {...rest}
      value={value}
      rows={1}
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
}
