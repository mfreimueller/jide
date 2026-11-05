import type { MenuItemConstructorOptions } from "electron";
import type { ThemeChoice } from "./settings";

export interface MenuOptions {
  platform: NodeJS.Platform;
  appName: string;
  /** Online mode only: adds "Abmelden…". */
  online: boolean;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  onLogout: () => void;
  /** Ansicht > Actual Size / Zoom In / Zoom Out; main keeps the zoom within the same limits as Ctrl + wheel. */
  onZoom: (action: ZoomAction) => void;
}

export type ZoomAction = "reset" | "in" | "out";

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Hell" },
  { id: "dark", label: "Dunkel" },
  { id: "system", label: "System" }
];

/**
 * Electron's default menu (as roles) for every mode, with the View menu renamed "Ansicht" and
 * "Darstellung" (Hell / Dunkel / System) at its end. No Help menu: its only items open electronjs.org.
 */
export function buildMenuTemplate(o: MenuOptions): MenuItemConstructorOptions[] {
  const logout: MenuItemConstructorOptions[] = o.online
    ? [{ id: "logout", label: "Abmelden…", click: () => o.onLogout() }, { type: "separator" }]
    : [];
  const ansicht: MenuItemConstructorOptions = {
    id: "ansicht",
    label: "Ansicht",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      // Not the zoomIn / zoomOut roles (no limit): same labels and accelerators, clicks go to onZoom.
      { id: "zoom-reset", label: "Actual Size", accelerator: "CommandOrControl+0", click: () => o.onZoom("reset") },
      { id: "zoom-in", label: "Zoom In", accelerator: "CommandOrControl+Plus", click: () => o.onZoom("in") },
      // Ctrl+= zooms in as well, without Shift (hidden duplicate)
      { id: "zoom-in-alt", label: "Zoom In", accelerator: "CommandOrControl+=", visible: false, acceleratorWorksWhenHidden: true, click: () => o.onZoom("in") },
      { id: "zoom-out", label: "Zoom Out", accelerator: "CommandOrControl+-", click: () => o.onZoom("out") },
      { type: "separator" },
      { role: "togglefullscreen" },
      { type: "separator" },
      {
        id: "darstellung",
        label: "Darstellung",
        submenu: THEMES.map(({ id, label }) => ({
          id: `theme-${id}`,
          label,
          type: "radio" as const,
          checked: o.theme === id,
          click: () => o.onTheme(id)
        }))
      }
    ]
  };
  return o.platform === "darwin"
    ? [
        {
          label: o.appName,
          submenu: [
            { role: "about" },
            { type: "separator" },
            ...logout,
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        },
        { role: "editMenu" },
        ansicht,
        { role: "windowMenu" }
      ]
    : [{ label: "Datei", submenu: [...logout, { role: "quit" }] }, { role: "editMenu" }, ansicht, { role: "windowMenu" }];
}
