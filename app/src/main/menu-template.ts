import type { BaseWindow, MenuItemConstructorOptions } from "electron";
import type { ThemeChoice } from "./settings";

export interface MenuOptions {
  platform: NodeJS.Platform;
  appName: string;
  /** Online mode only: adds "Abmelden…". */
  online: boolean;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  onLogout: () => void;
  /** Exam mode: no Datei > "Speichern unter …". */
  exam: boolean;
  /** Datei > Speichern unter … (Ctrl/Cmd+Shift+S): the focused window saves its open project as a ZIP. */
  onSaveAs: (window?: BaseWindow) => void;
  /** Ansicht > Editor-Schrift (Ctrl/Cmd +, -, 0): only the code editor's font size. The app has no window zoom. */
  onEditorFont: (action: FontAction) => void;
}

export type FontAction = "reset" | "in" | "out";

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
  const saveAs: MenuItemConstructorOptions[] = o.exam
    ? []
    : [{ id: "save-as", label: "Speichern unter…", accelerator: "CommandOrControl+Shift+S", click: (_item, window) => o.onSaveAs(window) }];
  const ansicht: MenuItemConstructorOptions = {
    id: "ansicht",
    label: "Ansicht",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { id: "editor-font-reset", label: "Editor-Schrift Standardgröße", accelerator: "CommandOrControl+0", click: () => o.onEditorFont("reset") },
      { id: "editor-font-in", label: "Editor-Schrift größer", accelerator: "CommandOrControl+Plus", click: () => o.onEditorFont("in") },
      // Ctrl+= as well, without Shift (hidden duplicate)
      { id: "editor-font-in-alt", label: "Editor-Schrift größer", accelerator: "CommandOrControl+=", visible: false, acceleratorWorksWhenHidden: true, click: () => o.onEditorFont("in") },
      { id: "editor-font-out", label: "Editor-Schrift kleiner", accelerator: "CommandOrControl+-", click: () => o.onEditorFont("out") },
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
        ...(o.exam ? [] : [{ id: "datei", label: "Datei", submenu: saveAs }]),
        { role: "editMenu" },
        ansicht,
        { role: "windowMenu" }
      ]
    : [
        { id: "datei", label: "Datei", submenu: [...(o.exam ? [] : [...saveAs, { type: "separator" as const }]), ...logout, { role: "quit" }] },
        { role: "editMenu" },
        ansicht,
        { role: "windowMenu" }
      ];
}
