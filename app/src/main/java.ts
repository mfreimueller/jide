import { join, resolve } from "node:path";
import { app } from "electron";

export const JAVA_MISSING_MESSAGE =
  "Java wurde nicht gefunden. Bitte installiere JDK 25 oder setze die Umgebungsvariable JAVA_HOME.";

const exe = process.platform === "win32" ? "java.exe" : "java";

/** The jlink'd JDK shipped inside the installed app (electron-builder extraResources "jdk"). */
function bundledJavaExecutable(): string {
  return join(process.resourcesPath, "jdk", "bin", exe);
}

/**
 * Packaged app: the bundled JDK. Dev/tests: JAVA_HOME/bin/java, otherwise `java` on the PATH.
 * (Exam mode will add the installed-JDK lookup here: jdkPath from exam.json -> JAVA_HOME -> PATH.)
 */
export function javaExecutable(): string {
  if (app.isPackaged) return bundledJavaExecutable();
  const home = process.env["JAVA_HOME"];
  if (home) return join(home, "bin", exe);
  return "java";
}

/** Packaged: the jar from extraResources. Dev: the jar built by java-helper (the app folder is app/). */
export function helperJarPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, "java-helper.jar");
  return resolve(app.getAppPath(), "..", "java-helper", "target", "java-helper.jar");
}
