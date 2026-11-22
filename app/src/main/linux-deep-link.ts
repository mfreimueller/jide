import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DESKTOP_FILE_NAME, ICON_FILE_NAME, ICON_SIZE_DIR, desktopEntryText, needsRewrite } from "./desktop-entry";

export interface LinuxDeepLinkDeps {
  /** `process.env.APPIMAGE`: absolute path of the running AppImage; undefined when not an AppImage. */
  appImage: string | undefined;
  /** Home folder; everything is written below `<home>/.local/share`. */
  home: string;
  /** The app icon (png) shipped in the AppImage's resources. */
  iconSource: string;
  /** Runs a command; rejects on failure (also when the tool is missing). */
  run: (cmd: string, args: string[]) => Promise<void>;
  log: (line: string) => void;
}

async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function copyIconIfChanged(src: string, dest: string, log: (line: string) => void): Promise<void> {
  try {
    const [a, b] = await Promise.all([readFile(src), readFile(dest).catch(() => null)]);
    if (b === null || !a.equals(b)) await copyFile(src, dest);
  } catch (e) {
    log(`icon not copied: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * AppImage installs no desktop entry, so the browser cannot hand jide:// links to J;DE. Keeps
 * `~/.local/share/applications/jde-jide.desktop` pointing at the running AppImage (rewritten when missing
 * or different, e.g. after the file moved) and registers it as handler. Never throws: problems are only
 * logged.
 */
export async function registerLinuxDeepLink(d: LinuxDeepLinkDeps): Promise<void> {
  if (!d.appImage) return;
  try {
    const share = join(d.home, ".local", "share");
    const appsDir = join(share, "applications");
    const iconDir = join(share, "icons", "hicolor", ICON_SIZE_DIR, "apps");
    const iconPath = join(iconDir, ICON_FILE_NAME);
    const desktopPath = join(appsDir, DESKTOP_FILE_NAME);

    const text = desktopEntryText(d.appImage, iconPath);
    if (text === null) {
      d.log(`jide:// registration skipped: path not usable: ${JSON.stringify(d.appImage)}`);
      return;
    }

    await mkdir(iconDir, { recursive: true });
    await copyIconIfChanged(d.iconSource, iconPath, d.log);

    await mkdir(appsDir, { recursive: true });
    if (needsRewrite(await readTextOrNull(desktopPath), text)) {
      await writeFile(desktopPath, text, "utf8");
      await chmod(desktopPath, 0o755).catch(() => undefined);
      d.log(`wrote ${desktopPath}`);
    }

    const commands: Array<[string, string[]]> = [
      ["update-desktop-database", [appsDir]],
      ["xdg-mime", ["default", DESKTOP_FILE_NAME, "x-scheme-handler/jide"]]
    ];
    for (const [cmd, args] of commands) {
      try {
        await d.run(cmd, args);
      } catch (e) {
        d.log(`${cmd} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    d.log(`jide:// registration failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Real command runner: 10 s limit, no shell. */
export function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err) => (err ? reject(err) : resolve()));
  });
}
