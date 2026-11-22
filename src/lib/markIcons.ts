// Icons the AI can name for its marks on the trip map (mark_on_map's `icon`), drawn white inside
// the red dot. Line icons in the site's inline-SVG style (like the menu icons). The backend's
// MARK_ICONS lists the same names; keep the two in step.
const PATHS: Record<string, string> = {
  landmark: '<path d="M12 2v3M10 5h4l1 16H9z"/><path d="M6 21h12M9.5 13h5"/>',
  utensils: '<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18"/><path d="M19 21V3c-2.5 1.5-4 4.5-4 8h4"/>',
  coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3v3M12 3v3"/>',
  bar: '<path d="M7 3h10l-1 6a4 4 0 0 1-8 0z"/><path d="M12 13v8M8 21h8"/>',
  "shopping-bag": '<path d="M5 8h14l-1 13H6z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
  camera: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6l1.5-2h5L16 6"/><circle cx="12" cy="13" r="3.5"/>',
  museum: '<path d="M2 10h20L12 3z"/><path d="M5 10v11M9.5 10v11M14.5 10v11M19 10v11M3 21h18"/>',
  park: '<path d="M12 3l-6 8h3l-4 5h14l-4-5h3z"/><path d="M12 16v6"/>',
  beach: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v8M5 21h14"/>',
  hotel: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="1.8"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4M9 14h.01M15 14h.01"/>',
  plane: '<path d="M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4.5l2.5 2V21L12 20l-4 1v-1.5l2.5-2V13l-7 2v-2l7-4z"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z"/>',
  pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};

export const MARK_ICON_NAMES = Object.keys(PATHS);

// The icon's SVG, or undefined for no icon or a name the site doesn't draw (the plain dot).
export function markIconSvg(name: string | undefined): string | undefined {
  const body = name && Object.hasOwn(PATHS, name) ? PATHS[name] : undefined;
  return body && `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
