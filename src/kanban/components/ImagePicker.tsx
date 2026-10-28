import { useRef } from 'react';

interface Props {
  onPick: (files: File[]) => void;
  disabled?: boolean;
}

/** 📎 button that opens the file chooser for images (pasting is handled on the textarea). */
export function ImagePicker({ onPick, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="ghost ghost--icon img-picker"
        aria-label="Attach images"
        title="Attach images (or paste a screenshot)"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        📎
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ''; // so picking the same file again still fires
          if (files.length) onPick(files);
        }}
      />
    </>
  );
}
