import { join, resolve } from "node:path";
import { app } from "electron";

export const JAVA_MISSING_MESSAGE =
  "Java wurde nicht gefunden. Bitte installiere JDK 25 oder setze die Umgebungsvariable JAVA_HOME.";

/** Dev lookup: JAVA_HOME/bin/java, otherwise `java` on the PATH. (The bundled JDK comes later.) */
export function javaExecutable(): string {
  const home = process.env["JAVA_HOME"];
  if (home) return join(home, "bin", process.platform === "win32" ? "java.exe" : "java");
  return "java";
}

/** Dev: the jar built by java-helper (the app folder is app/ in dev). Packaging comes later. */
export function helperJarPath(): string {
  return resolve(app.getAppPath(), "..", "java-helper", "target", "java-helper.jar");
}
