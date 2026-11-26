import { useRef, useState } from "react";
import type React from "react";
import { carriesFiles, droppedImages } from "./lib";

/**
 * Drag-and-drop of image files onto a pane. Spread `handlers` on the element;
 * `dragging` is true while files are held over it. A drop an inner drop zone
 * already took (it called preventDefault) only clears the highlight here.
 */
export function useImageDrop(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child crossed, so count the depth.
  const depth = useRef(0);
  const reset = () => {
    depth.current = 0;
    setDragging(false);
  };

  const handlers = {
    onDragEnter(e: React.DragEvent) {
      if (!carriesFiles(e.dataTransfer)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver(e: React.DragEvent) {
      if (!carriesFiles(e.dataTransfer)) return;
      // Without this the browser opens the dropped file in place of the page.
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave(e: React.DragEvent) {
      if (!carriesFiles(e.dataTransfer)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop(e: React.DragEvent) {
      if (!carriesFiles(e.dataTransfer)) return;
      reset();
      if (e.defaultPrevented) return;
      e.preventDefault();
      const files = droppedImages(e.dataTransfer);
      if (files.length) onFiles(files);
    },
  };
  return { dragging, handlers };
}
