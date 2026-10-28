import { useEffect, useRef, useState } from 'react';
import type { KanbanImage } from '../types';

interface Props {
  images: KanbanImage[];
  /** Which image to open on; null = closed. */
  openAt: number | null;
  onClose: () => void;
}

const SWIPE_PX = 50;

/**
 * Full-screen look at an image. Fits the viewport; click toggles 1:1, and a
 * 1:1 image pans by dragging or scrolling. ←/→ (or a swipe) step through the
 * gallery. A native <dialog>, so Esc, focus trapping and focus return come free.
 */
export function ImageViewer({ images, openAt, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (openAt === null) {
      if (el.open) el.close();
      return;
    }
    setIndex(openAt);
    setZoomed(false);
    if (!el.open) el.showModal();
  }, [openAt]);

  const count = images.length;
  const image = images[Math.min(index, count - 1)];
  const go = (step: number) => {
    setIndex((i) => (i + step + count) % count);
    setZoomed(false);
  };

  useEffect(() => {
    if (zoomed && stage.current) {
      // Start 1:1 centred on the image rather than its top-left corner.
      const s = stage.current;
      s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2;
      s.scrollTop = (s.scrollHeight - s.clientHeight) / 2;
    }
  }, [zoomed]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stage.current!;
    drag.current = { x: e.clientX, y: e.clientY, left: s.scrollLeft, top: s.scrollTop, moved: false };
    s.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !zoomed) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    stage.current!.scrollLeft = d.left - dx;
    stage.current!.scrollTop = d.top - dy;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!zoomed && count > 1 && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
      go(dx < 0 ? 1 : -1);
    } else if (!d.moved) {
      setZoomed((z) => !z);
    }
  };

  if (!image) return null;

  return (
    <dialog
      ref={dialog}
      className="img-viewer"
      aria-label={`Image ${index + 1} of ${count}`}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      onKeyDown={(e) => {
        // The card drawer closes on a window-level Esc; this one is just for the viewer.
        if (e.key === 'Escape') e.stopPropagation();
        if (count > 1 && e.key === 'ArrowRight') go(1);
        if (count > 1 && e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div
        ref={stage}
        className="img-viewer__stage"
        data-zoomed={zoomed || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <img
          src={image.url}
          alt={`Image ${index + 1} of ${count}`}
          width={image.w}
          height={image.h}
          draggable={false}
          style={zoomed ? { width: image.w, height: image.h } : undefined}
        />
      </div>

      <div className="img-viewer__bar">
        <span>{count > 1 ? `${index + 1} / ${count}` : ''}</span>
        <a href={image.url} target="_blank" rel="noreferrer">
          Open original
        </a>
        <button className="img-viewer__btn" aria-label="Close" onClick={() => dialog.current?.close()}>
          ✕
        </button>
      </div>
      {count > 1 && (
        <>
          <button className="img-viewer__btn img-viewer__nav" data-dir="prev" aria-label="Previous image" onClick={() => go(-1)}>
            ‹
          </button>
          <button className="img-viewer__btn img-viewer__nav" data-dir="next" aria-label="Next image" onClick={() => go(1)}>
            ›
          </button>
        </>
      )}
    </dialog>
  );
}
