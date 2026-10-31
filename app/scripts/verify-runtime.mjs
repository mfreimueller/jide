// Checks a runtime (default: app/build/jdk) the way students will use it:
// German javac messages and German number formatting (needs jdk.localedata).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", "build", "jdk");
const java = join(root, "bin", process.platform === "win32" ? "java.exe" : "java");
const dir = mkdtempSync(join(tmpdir(), "jde-runtime-"));

writeFileSync(
  join(dir, "Fmt.java"),
  'import java.util.*;\npublic class Fmt { public static void main(String[] a) {\n' +
    '  System.out.println(String.format(Locale.GERMANY, "%.1f", 3.5));\n' +
    '  System.out.println(new Scanner("3,5").useLocale(Locale.GERMANY).nextDouble());\n}}\n'
);
const out = execFileSync(java, [join(dir, "Fmt.java")], { encoding: "utf8" }).trim().split(/\r?\n/);
if (out[0] !== "3,5" || out[1] !== "3.5") throw new Error("locale check failed: " + JSON.stringify(out));

writeFileSync(join(dir, "Bad.java"), "public class Bad { void f() { int x = y; } }\n");
let err = "";
try {
  execFileSync(java, ["-Duser.language=de", "-Duser.country=DE", "-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", dir, join(dir, "Bad.java")], {
    encoding: "utf8", stdio: "pipe"
  });
} catch (e) {
  err = String(e.stderr);
}
if (!/Symbol nicht gefunden/.test(err)) throw new Error("javac messages are not German:\n" + err);
console.log("runtime OK: German locale formatting and javac messages");
