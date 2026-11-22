import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** "The longer version" box: grows to fit the note, so a long one shows
 *  without dragging the corner. Its starting and largest heights are in
 *  drawer.css (.note-box). */
export function NoteBox(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight leaves out the border, which border-box sizing counts.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [props.value]);

  return <textarea {...props} ref={ref} className="note-box" />;
}
