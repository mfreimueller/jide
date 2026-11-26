import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { buildMenuTemplate, type MenuOptions } from "./menu-template";

const base: MenuOptions = {
  platform: "win32",
  appName: "J;DE",
  online: false,
  theme: "system",
  onTheme: () => undefined,
  onLogout: () => undefined,
  exam: false,
  onSaveAs: () => undefined,
  onEditorFont: () => undefined
};

const sub = (item: MenuItemConstructorOptions): MenuItemConstructorOptions[] => item.submenu as MenuItemConstructorOptions[];
const ansicht = (t: MenuItemConstructorOptions[]) => t.find((m) => m.id === "ansicht")!;
const logoutIn = (t: MenuItemConstructorOptions[]) => t.flatMap((m) => (Array.isArray(m.submenu) ? m.submenu : [])).find((i) => i.id === "logout");

describe("buildMenuTemplate", () => {
  it.each(["win32", "darwin", "linux"] as const)("%s: Ansicht holds the default view items, then Darstellung", (platform) => {
    const view = ansicht(buildMenuTemplate({ ...base, platform }));
    expect(view.label).toBe("Ansicht");
    const items = sub(view);
    expect(items.map((i) => i.role ?? i.type ?? i.id)).toEqual([
      "reload",
      "forceReload",
      "toggleDevTools",
      "separator",
      "editor-font-reset",
      "editor-font-in",
      "editor-font-in-alt",
      "editor-font-out",
      "separator",
      "togglefullscreen",
      "separator",
      "darstellung"
    ]);
    const darstellung = items.at(-1)!;
    expect(darstellung.label).toBe("Darstellung");
    expect(sub(darstellung).map((i) => [i.id, i.label, i.type])).toEqual([
      ["theme-light", "Hell", "radio"],
      ["theme-dark", "Dunkel", "radio"],
      ["theme-system", "System", "radio"]
    ]);
  });

  it("there are no zoom items any more", () => {
    const ids = sub(ansicht(buildMenuTemplate(base))).map((i) => i.id ?? "");
    expect(ids.filter((id) => id.startsWith("zoom"))).toEqual([]);
  });

  it("editor font items take the former zoom accelerators and report their action", () => {
    const onEditorFont = vi.fn();
    const items = sub(ansicht(buildMenuTemplate({ ...base, onEditorFont })));
    const by = (id: string) => items.find((i) => i.id === id)!;
    expect(["editor-font-reset", "editor-font-in", "editor-font-out"].map((id) => [by(id).label, by(id).accelerator])).toEqual([
      ["Editor-Schrift Standardgröße", "CommandOrControl+0"],
      ["Editor-Schrift größer", "CommandOrControl+Plus"],
      ["Editor-Schrift kleiner", "CommandOrControl+-"]
    ]);
    expect(by("editor-font-in-alt")).toMatchObject({ accelerator: "CommandOrControl+=", visible: false, acceleratorWorksWhenHidden: true });
    for (const [id, action] of [["editor-font-reset", "reset"], ["editor-font-in", "in"], ["editor-font-in-alt", "in"], ["editor-font-out", "out"]] as const) {
      (by(id).click as () => void)();
      expect(onEditorFont).toHaveBeenLastCalledWith(action);
    }
  });

  it.each(["light", "dark", "system"] as const)("checks exactly the stored choice (%s)", (theme) => {
    const items = sub(sub(ansicht(buildMenuTemplate({ ...base, theme }))).at(-1)!);
    expect(items.filter((i) => i.checked).map((i) => i.id)).toEqual([`theme-${theme}`]);
  });

  it("a click on a radio item reports the choice", () => {
    const onTheme = vi.fn();
    const items = sub(sub(ansicht(buildMenuTemplate({ ...base, onTheme }))).at(-1)!);
    (items[1]!.click as () => void)();
    expect(onTheme).toHaveBeenCalledWith("dark");
  });

  it.each(["win32", "darwin"] as const)("%s: Abmelden only online", (platform) => {
    expect(logoutIn(buildMenuTemplate({ ...base, platform, online: false }))).toBeUndefined();
    const onLogout = vi.fn();
    const item = logoutIn(buildMenuTemplate({ ...base, platform, online: true, onLogout }));
    expect(item?.label).toBe("Abmelden…");
    (item!.click as () => void)();
    expect(onLogout).toHaveBeenCalled();
  });

  it("has the default menus: app menu on macOS, Datei on the others, Edit and Window always, no Help", () => {
    const mac = buildMenuTemplate({ ...base, platform: "darwin" });
    expect(mac.map((m) => m.label ?? m.role)).toEqual(["J;DE", "Datei", "editMenu", "Ansicht", "windowMenu"]);
    expect(sub(mac[0]!).map((i) => i.role).filter(Boolean)).toContain("quit");
    const win = buildMenuTemplate({ ...base, platform: "win32" });
    expect(win.map((m) => m.label ?? m.role)).toEqual(["Datei", "editMenu", "Ansicht", "windowMenu"]);
    expect(sub(win[0]!).map((i) => i.role ?? i.type ?? i.id)).toEqual(["save-as", "separator", "quit"]);
  });

  const saveAsIn = (t: MenuItemConstructorOptions[]) => t.flatMap((m) => (Array.isArray(m.submenu) ? m.submenu : [])).find((i) => i.id === "save-as");

  it.each(["win32", "linux", "darwin"] as const)("%s: Datei > Speichern unter… with Ctrl/Cmd+Shift+S asks the window to save", (platform) => {
    const onSaveAs = vi.fn();
    const item = saveAsIn(buildMenuTemplate({ ...base, platform, onSaveAs }));
    expect(item).toMatchObject({ label: "Speichern unter…", accelerator: "CommandOrControl+Shift+S" });
    (item!.click as () => void)();
    expect(onSaveAs).toHaveBeenCalledOnce();
  });

  it.each(["win32", "linux", "darwin"] as const)("%s: no Speichern unter… in exam mode", (platform) => {
    const t = buildMenuTemplate({ ...base, platform, exam: true });
    expect(saveAsIn(t)).toBeUndefined();
    expect(t.some((m) => m.label === "Datei" && platform === "darwin")).toBe(false);
  });

  it("win32 online: Speichern unter…, separator, Abmelden…, separator, quit", () => {
    const datei = buildMenuTemplate({ ...base, platform: "win32", online: true })[0]!;
    expect(sub(datei).map((i) => i.role ?? i.type ?? i.id)).toEqual(["save-as", "separator", "logout", "separator", "quit"]);
  });

  it("win32 exam: Datei has only quit", () => {
    expect(sub(buildMenuTemplate({ ...base, platform: "win32", exam: true })[0]!).map((i) => i.role)).toEqual(["quit"]);
  });
});
