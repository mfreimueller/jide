/** The editor font size (px), the same in every window; main owns it and pushes changes. Not persisted. */
const DEFAULT_SIZE = 14;

export const editorFont = $state({ size: DEFAULT_SIZE });

/** Line height for a font size: 14 px -> 22 px, scaled. */
export function editorLineHeight(size: number): number {
  return Math.round((size * 22) / 14);
}

let started = false;

/** Once per window: fetch the current size and follow later changes. */
export function startEditorFont(): void {
  if (started) return;
  started = true;
  window.jide.onEditorFontSize((size) => (editorFont.size = size));
  void window.jide.editorFontSize().then((size) => (editorFont.size = size));
}
