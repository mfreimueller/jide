/**
 * Panels in their own windows (M10, #11). Pure logic shared by main and renderer: which panels exist,
 * which are detached, what the main window shows meanwhile, window titles and where a new window opens.
 */

/** The five panels that can have their own window; the order is the order of the chips. */
export const DETACHABLE_PANELS = ["code", "assign", "console", "problems", "tests"] as const;
export type DetachablePanel = (typeof DETACHABLE_PANELS)[number];

export const BOTTOM_TABS = ["Konsole", "Probleme", "Tests"] as const;
export type BottomTab = (typeof BOTTOM_TABS)[number];

export const PANEL_LABEL: Record<DetachablePanel, string> = {
  code: "Code",
  assign: "Angabe",
  console: "Konsole",
  problems: "Probleme",
  tests: "Tests"
};

export const BACK_LABEL = "↙ Zurück ins Hauptfenster";

export function isDetachablePanel(value: unknown): value is DetachablePanel {
  return typeof value === "string" && (DETACHABLE_PANELS as readonly string[]).includes(value);
}

/** Bottom panel tab -> panel; the three tabs are three panels. */
export function panelOfTab(tab: BottomTab): DetachablePanel {
  return tab === "Konsole" ? "console" : tab === "Probleme" ? "problems" : "tests";
}

export function tabOfPanel(panel: DetachablePanel): BottomTab | undefined {
  return panel === "console" ? "Konsole" : panel === "problems" ? "Probleme" : panel === "tests" ? "Tests" : undefined;
}

/** Adds a panel (keeps the canonical order, no duplicates). */
export function detach(set: readonly DetachablePanel[], panel: DetachablePanel): DetachablePanel[] {
  return DETACHABLE_PANELS.filter((p) => p === panel || set.includes(p));
}

/** Removes a panel (docked again). */
export function dock(set: readonly DetachablePanel[], panel: DetachablePanel): DetachablePanel[] {
  return DETACHABLE_PANELS.filter((p) => p !== panel && set.includes(p));
}

/** Tooltip of the ⧉ button. */
export function detachTip(panel: DetachablePanel): string {
  return `${PANEL_LABEL[panel]} in eigenem Fenster öffnen`;
}

export interface PanelChip {
  panel: DetachablePanel;
  /** "Angabe ↗" */
  text: string;
  tip: string;
}

/** One chip per detached panel, in the canonical order. */
export function chips(set: readonly DetachablePanel[]): PanelChip[] {
  return DETACHABLE_PANELS.filter((p) => set.includes(p)).map((panel) => ({
    panel,
    text: `${PANEL_LABEL[panel]} ↗`,
    tip: `${PANEL_LABEL[panel]} ist in einem eigenen Fenster – Klick holt es nach vorne. Schließen holt es zurück.`
  }));
}

/** Native window title: "J;DE – Angabe – Summe". */
export function windowTitle(panel: DetachablePanel, exerciseTitle: string): string {
  return `J;DE – ${PANEL_LABEL[panel]} – ${exerciseTitle}`;
}

/** The tabs the bottom panel of the main window still shows (Tests only for exercises with tests). */
export function remainingBottomTabs(set: readonly DetachablePanel[], hasTests: boolean): BottomTab[] {
  return BOTTOM_TABS.filter((t) => (t !== "Tests" || hasTests) && !set.includes(panelOfTab(t)));
}

/** With all tabs detached the bottom panel disappears from the main window. */
export function bottomPanelVisible(set: readonly DetachablePanel[], hasTests: boolean): boolean {
  return remainingBottomTabs(set, hasTests).length > 0;
}

/** The tab to show: the wanted one if it is still in the main window, else the first remaining one. */
export function effectiveBottomTab(wanted: BottomTab, set: readonly DetachablePanel[], hasTests: boolean): BottomTab {
  const left = remainingBottomTabs(set, hasTests);
  return left.includes(wanted) ? wanted : (left[0] ?? wanted);
}

// --- window placement -------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  workArea: Rect;
}

export const DEFAULT_WINDOW_SIZE: Record<DetachablePanel, { width: number; height: number }> = {
  code: { width: 900, height: 700 },
  assign: { width: 480, height: 700 },
  console: { width: 760, height: 420 },
  problems: { width: 700, height: 420 },
  tests: { width: 700, height: 480 }
};

export const MIN_WINDOW_SIZE = { width: 360, height: 240 };

function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function contains(r: Rect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function fit(size: { width: number; height: number }, area: Rect): { width: number; height: number } {
  return { width: Math.min(size.width, area.width), height: Math.min(size.height, area.height) };
}

/**
 * Where a detached window opens. Within a session it reopens at its last bounds (if that is still on a
 * connected display). The first time: centred on a secondary display if one is connected, else next to
 * the main window (right of it if that fits on its display, else left, else overlapping its right edge).
 */
export function placeWindow(o: {
  panel: DetachablePanel;
  saved?: Rect;
  main: Rect;
  displays: DisplayInfo[];
}): Rect {
  const { panel, saved, main, displays } = o;
  if (saved && displays.some((d) => intersects(d.workArea, saved))) return saved;
  const size = DEFAULT_WINDOW_SIZE[panel];
  const mainDisplay = displays.find((d) => contains(d.workArea, center(main))) ?? displays[0];
  const secondary = displays.find((d) => d.id !== mainDisplay?.id);
  if (secondary) {
    const s = fit(size, secondary.workArea);
    const a = secondary.workArea;
    return { x: Math.round(a.x + (a.width - s.width) / 2), y: Math.round(a.y + (a.height - s.height) / 2), ...s };
  }
  const area = mainDisplay?.workArea ?? { x: 0, y: 0, width: 1920, height: 1080 };
  const s = fit(size, area);
  const y = Math.max(area.y, Math.min(main.y, area.y + area.height - s.height));
  const right = main.x + main.width;
  if (right + s.width <= area.x + area.width) return { x: right, y, ...s };
  if (main.x - s.width >= area.x) return { x: main.x - s.width, y, ...s };
  return { x: Math.max(area.x, area.x + area.width - s.width), y, ...s };
}
