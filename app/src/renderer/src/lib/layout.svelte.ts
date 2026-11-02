import { DEFAULT_SIZE, type PanelId } from "./panel-layout";

/**
 * Layout of the student workspace (T29). One module-level state for the whole app run, so it is shared
 * by every Workspace (the exam keeps one per exercise tab) and by the next exercise. It is not saved:
 * every start of the app begins with the default layout.
 */
export const layout = $state({
  filesCollapsed: false,
  assignCollapsed: false,
  bottomCollapsed: false,
  filesWidth: DEFAULT_SIZE.files as number,
  assignWidth: DEFAULT_SIZE.assign as number,
  bottomHeight: DEFAULT_SIZE.bottom as number
});

export function togglePanel(panel: PanelId): void {
  if (panel === "files") layout.filesCollapsed = !layout.filesCollapsed;
  else if (panel === "assign") layout.assignCollapsed = !layout.assignCollapsed;
  else layout.bottomCollapsed = !layout.bottomCollapsed;
}

export function openBottom(): void {
  layout.bottomCollapsed = false;
}

/** Alt+1/2/3. `event.code` because Alt+digit types special characters on macOS. */
export const SHORTCUT_PANEL: Record<string, PanelId> = { Digit1: "files", Digit2: "assign", Digit3: "bottom" };
