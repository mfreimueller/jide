/** Sizes of the workspace panels (T29). Pure helpers; the shared state is in layout.svelte.ts. */

export type PanelId = "files" | "assign" | "bottom";

export const DEFAULT_SIZE = { files: 210, assign: 330, bottom: 230 } as const;
/** Width of a collapsed side panel (the strip). */
export const STRIP_WIDTH = 32;
/** The side panels never get narrower than this when open ... */
export const SIDE_MIN = 160;
/** ... and the editor keeps at least this width. */
export const EDITOR_MIN_WIDTH = 300;
/** The open bottom panel (tab bar included) never gets lower than this ... */
export const BOTTOM_MIN = 140;
/** ... and the editor area (tab row + editor) keeps at least this height. */
export const EDITOR_MIN_HEIGHT = 150;
/** Height of the editor's tab row. */
export const EDITOR_TABS_HEIGHT = 38;
/** Height of the bottom panel's tab bar (1px border-top included). */
export const BOTTOM_BAR_HEIGHT = 37;

/** Keeps `value` within [min, max]; if the room is too small, `min` wins. */
export function clampSize(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/** Largest width for a side panel: the editor keeps EDITOR_MIN_WIDTH next to the other side panel. */
export function maxSideWidth(workWidth: number, otherSideWidth: number): number {
  return workWidth - otherSideWidth - EDITOR_MIN_WIDTH;
}

/** Largest height for the open bottom panel (tab bar included). */
export function maxBottomHeight(centerHeight: number): number {
  return centerHeight - EDITOR_TABS_HEIGHT - EDITOR_MIN_HEIGHT;
}
