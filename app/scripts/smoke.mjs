import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronPath = require("electron"); // path to the electron binary
const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: { ...process.env, JIDE_SMOKE: "1" }
});
child.on("exit", (code) => process.exit(code ?? 1));
