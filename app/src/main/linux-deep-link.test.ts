import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { desktopEntryText, needsRewrite, quoteExecArg } from "./desktop-entry";
import { registerLinuxDeepLink } from "./linux-deep-link";

describe("quoteExecArg", () => {
  it("quotes a plain path", () => {
    expect(quoteExecArg("/home/s/Applications/JDE.AppImage")).toBe('"/home/s/Applications/JDE.AppImage"');
  });
  it("keeps spaces inside the quotes", () => {
    expect(quoteExecArg("/home/a b/JDE.AppImage")).toBe('"/home/a b/JDE.AppImage"');
  });
  it("escapes quote, backtick and dollar with a backslash, which the string rule doubles", () => {
    expect(quoteExecArg('/a"b')).toBe('"/a\\\\"b"');
    expect(quoteExecArg("/a`b")).toBe('"/a\\\\`b"');
    expect(quoteExecArg("/a$b")).toBe('"/a\\\\$b"');
  });
  it("writes a literal backslash as four backslashes", () => {
    expect(quoteExecArg("/a\\b")).toBe('"/a\\\\\\\\b"');
  });
  it("doubles percent so it is no field code", () => {
    expect(quoteExecArg("/a%u")).toBe('"/a%%u"');
  });
  it("refuses empty paths and control characters", () => {
    expect(quoteExecArg("")).toBeNull();
    expect(quoteExecArg("/a\nb")).toBeNull();
  });
});

describe("desktopEntryText", () => {
  it("has the required keys", () => {
    const t = desktopEntryText("/home/s/Applications/JDE.AppImage", "/home/s/.local/share/icons/hicolor/512x512/apps/jde.png")!;
    expect(t).toBe(
      [
        "[Desktop Entry]",
        "Type=Application",
        "Name=J;DE",
        'Exec="/home/s/Applications/JDE.AppImage" %u',
        "Icon=/home/s/.local/share/icons/hicolor/512x512/apps/jde.png",
        "Terminal=false",
        "Categories=Education;",
        "MimeType=x-scheme-handler/jide;",
        ""
      ].join("\n")
    );
  });
  it("is null for an unusable path", () => {
    expect(desktopEntryText("/a\nb", "/i.png")).toBeNull();
  });
});

describe("needsRewrite", () => {
  it("is true when missing or different, false when equal", () => {
    expect(needsRewrite(null, "x")).toBe(true);
    expect(needsRewrite("y", "x")).toBe(true);
    expect(needsRewrite("x", "x")).toBe(false);
  });
});

describe("registerLinuxDeepLink (temp home, no system changes)", () => {
  let home: string;
  let iconSource: string;
  let calls: Array<[string, string[]]>;
  let logs: string[];
  const deps = (over: Partial<Parameters<typeof registerLinuxDeepLink>[0]> = {}) => ({
    appImage: "/home/s/Applications/JDE.AppImage",
    home,
    iconSource,
    run: async (cmd: string, args: string[]) => void calls.push([cmd, args]),
    log: (l: string) => void logs.push(l),
    ...over
  });

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "jde-home-"));
    iconSource = join(home, "icon-src.png");
    await writeFile(iconSource, "PNGDATA");
    calls = [];
    logs = [];
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  const desktop = () => join(home, ".local", "share", "applications", "jde-jide.desktop");

  it("does nothing without APPIMAGE", async () => {
    await registerLinuxDeepLink(deps({ appImage: undefined }));
    expect(calls).toEqual([]);
    await expect(stat(join(home, ".local"))).rejects.toThrow();
  });

  it("writes entry and icon, then registers the handler", async () => {
    await registerLinuxDeepLink(deps());
    const text = await readFile(desktop(), "utf8");
    expect(text).toContain('Exec="/home/s/Applications/JDE.AppImage" %u');
    const icon = join(home, ".local", "share", "icons", "hicolor", "512x512", "apps", "jde.png");
    expect(text).toContain(`Icon=${icon}`);
    expect(await readFile(icon, "utf8")).toBe("PNGDATA");
    expect(calls).toEqual([
      ["update-desktop-database", [join(home, ".local", "share", "applications")]],
      ["xdg-mime", ["default", "jde-jide.desktop", "x-scheme-handler/jide"]]
    ]);
  });

  it("rewrites a changed entry and leaves an equal one alone", async () => {
    await registerLinuxDeepLink(deps());
    await writeFile(desktop(), "stale");
    await registerLinuxDeepLink(deps());
    expect(await readFile(desktop(), "utf8")).toContain("Exec=");
    logs.length = 0;
    await registerLinuxDeepLink(deps());
    expect(logs.filter((l) => l.startsWith("wrote"))).toEqual([]);
  });

  it("follows a moved AppImage", async () => {
    await registerLinuxDeepLink(deps());
    await registerLinuxDeepLink(deps({ appImage: "/opt/JDE.AppImage" }));
    expect(await readFile(desktop(), "utf8")).toContain('Exec="/opt/JDE.AppImage" %u');
  });

  it("only logs failing or missing tools and a missing icon", async () => {
    await registerLinuxDeepLink(
      deps({
        iconSource: join(home, "missing.png"),
        run: async () => {
          throw new Error("spawn ENOENT");
        }
      })
    );
    expect(await readFile(desktop(), "utf8")).toContain("Exec=");
    expect(logs.some((l) => l.includes("update-desktop-database failed"))).toBe(true);
    expect(logs.some((l) => l.includes("xdg-mime failed"))).toBe(true);
    expect(logs.some((l) => l.includes("icon not copied"))).toBe(true);
  });

  it("never throws when the home folder is unusable", async () => {
    await mkdir(join(home, "f"));
    await writeFile(join(home, "file"), "x");
    await expect(registerLinuxDeepLink(deps({ home: join(home, "file") }))).resolves.toBeUndefined();
    expect(logs.some((l) => l.includes("registration failed"))).toBe(true);
  });

  it("skips an AppImage path that cannot be quoted", async () => {
    await registerLinuxDeepLink(deps({ appImage: "/a\nb" }));
    expect(calls).toEqual([]);
    expect(logs.some((l) => l.includes("skipped"))).toBe(true);
  });
});
