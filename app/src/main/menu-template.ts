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
}

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
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
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
