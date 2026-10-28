import { useState } from 'react';
import type { KanbanImage } from '../types';
import { ImageViewer } from './ImageViewer';

interface Props {
  images: KanbanImage[];
  /** Who/what the images belong to, for alt text ("Screenshot 1 of 3, by Tony"). */
  label: string;
  /** Present = show a remove control on each image. */
  onRemove?: (imageId: string) => void;
}

const MAX_TILES = 4;

/**
 * Thumbnails that look right at any size. One image shows large at its own
 * aspect ratio (box reserved from the stored w/h, so nothing jumps on load);
 * 2+ sit in a two-column grid of uniform tiles. Either way a click opens the
 * full image in the viewer, so cropping in a tile never hides anything.
 */
export function ImageGallery({ images, label, onRemove }: Props) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (images.length === 0) return null;

  const shown = images.slice(0, MAX_TILES);
  const extra = images.length - shown.length;

  return (
    <>
      <div className="img-gallery" data-count={Math.min(images.length, MAX_TILES)}>
        {shown.map((image, i) => (
          <div key={image.id} className="img-thumb">
            <button
              type="button"
              className="img-thumb__open"
              aria-label={`${label}, image ${i + 1} of ${images.length}`}
              onClick={() => setOpenAt(i)}
            >
              <img
                src={image.url}
                alt=""
                width={image.w}
                height={image.h}
                loading="lazy"
                decoding="async"
              />
              {extra > 0 && i === MAX_TILES - 1 && <span className="img-thumb__more">+{extra}</span>}
            </button>
            {onRemove && (
              <button
                type="button"
                className="img-thumb__remove"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => onRemove(image.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <ImageViewer images={images} openAt={openAt} onClose={() => setOpenAt(null)} />
    </>
  );
}
