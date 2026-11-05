import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { buildMenuTemplate, type MenuOptions } from "./menu-template";

const base: MenuOptions = {
  platform: "win32",
  appName: "J;DE",
  online: false,
  theme: "system",
  onTheme: () => undefined,
  onLogout: () => undefined
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
      "resetZoom",
      "zoomIn",
      "zoomOut",
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
    expect(mac.map((m) => m.label ?? m.role)).toEqual(["J;DE", "editMenu", "Ansicht", "windowMenu"]);
    expect(sub(mac[0]!).map((i) => i.role).filter(Boolean)).toContain("quit");
    const win = buildMenuTemplate({ ...base, platform: "win32" });
    expect(win.map((m) => m.label ?? m.role)).toEqual(["Datei", "editMenu", "Ansicht", "windowMenu"]);
    expect(sub(win[0]!).map((i) => i.role)).toEqual(["quit"]);
  });
});
