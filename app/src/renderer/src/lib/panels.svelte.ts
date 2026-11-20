import { chips, type DetachablePanel } from "../../../shared-types/panel-windows";

/** Which panels are in their own window (M10). Main owns the truth; every window keeps this copy. */
export const panels = $state({ detached: [] as DetachablePanel[] });

export function isDetached(panel: DetachablePanel): boolean {
  return panels.detached.includes(panel);
}

export function panelChips(): ReturnType<typeof chips> {
  return chips(panels.detached);
}

let entries = 0;
/** A new id for every workspace that enters; main ignores a "leave" of an older one. */
export function nextPanelEntry(): number {
  return ++entries;
}

/** Starts following main; call once per window. Returns the stop function. */
export function followDetachedPanels(): () => void {
  const stop = window.jide.panels.onChange((list) => (panels.detached = [...list]));
  void window.jide.panels.getDetached().then((list) => {
    // a change that arrived meanwhile is newer than this answer
    if (panels.detached.length === 0) panels.detached = [...list];
  });
  return stop;
}
