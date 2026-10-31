// Builds the bundled JDK (app/build/jdk) with jlink from the JDK in JAVA_HOME.
// jdk.localedata is required so number/date formatting matches the full JDK (German "3,5").
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "build", "jdk");
const home = process.env.JAVA_HOME;
if (!home) throw new Error("JAVA_HOME must point to a JDK 25");
const jlink = join(home, "bin", process.platform === "win32" ? "jlink.exe" : "jlink");
rmSync(out, { recursive: true, force: true });
execFileSync(
  jlink,
  [
    "--add-modules", "java.base,jdk.compiler,jdk.localedata",
    "--strip-debug", "--no-man-pages", "--no-header-files", "--compress=zip-6",
    "--output", out
  ],
  { stdio: "inherit" }
);
console.log("runtime written to " + out);
