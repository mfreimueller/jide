import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import type { Diagnostic } from "../shared-types/api";
import { JAVA_MISSING_MESSAGE } from "./java";
import { RestartLimiter } from "./restart-limiter";

export class HelperError extends Error {}

export interface HelperCompileRequest {
  files: { path: string; content: string }[];
  harness?: { appendTo: string; content: string };
  outDir?: string;
}
export interface HelperCompileResponse {
  success: boolean;
  diagnostics: Diagnostic[];
}

interface Pending {
  resolve: (r: Record<string, unknown>) => void;
  reject: (e: HelperError) => void;
}

/**
 * Client of the long-running java-helper process (JSON lines over stdin/stdout).
 * Started lazily; if it dies it is started again with the next request (max. 3 restarts per minute).
 */
export class HelperClient {
  private proc: ChildProcessWithoutNullStreams | undefined;
  private buf = "";
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private readonly limiter = new RestartLimiter();
  private javaMissing = false;

  constructor(
    private readonly javaPath: string,
    private readonly jarPath: string
  ) {}

  /** Starts the helper if needed and checks that it answers. */
  async ping(): Promise<void> {
    await this.request({ op: "ping" });
  }

  async compile(req: HelperCompileRequest): Promise<HelperCompileResponse> {
    const r = await this.request({ op: "compile", ...req });
    return { success: r["success"] === true, diagnostics: (r["diagnostics"] as Diagnostic[]) ?? [] };
  }

  shutdown(): void {
    this.proc?.kill();
    this.proc = undefined;
  }

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.proc) return this.proc;
    if (this.javaMissing) throw new HelperError(JAVA_MISSING_MESSAGE);
    if (!existsSync(this.jarPath)) {
      throw new HelperError(
        "Der Java-Helfer (java-helper.jar) wurde nicht gefunden. Bitte zuerst „npm run build“ ausführen."
      );
    }
    if (!this.limiter.tryStart()) {
      throw new HelperError("Der Java-Helfer ist mehrfach abgestürzt. Bitte starte J;DE neu.");
    }
    const proc = spawn(this.javaPath, ["-jar", this.jarPath], { stdio: "pipe", windowsHide: true });
    this.proc = proc;
    this.buf = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    proc.stderr.resume(); // never let the helper block on a full stderr pipe
    proc.stdin.on("error", () => undefined); // reported through "exit"/"error" below
    proc.on("error", (e: NodeJS.ErrnoException) => {
      // A missing java never fixes itself while the app runs: do not retry on every keystroke.
      if (e.code === "ENOENT") this.javaMissing = true;
      this.died(proc, e.code === "ENOENT" ? JAVA_MISSING_MESSAGE : "Der Java-Helfer konnte nicht gestartet werden.");
    });
    proc.on("exit", () => this.died(proc, "Der Java-Helfer wurde unerwartet beendet."));
    return proc;
  }

  private died(proc: ChildProcessWithoutNullStreams, message: string): void {
    if (this.proc !== proc) return; // already handled
    this.proc = undefined;
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const p of pending) p.reject(new HelperError(message));
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let i: number;
    while ((i = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 1);
      if (!line.trim()) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      const id = msg["id"];
      const p = typeof id === "number" ? this.pending.get(id) : undefined;
      if (!p) continue;
      this.pending.delete(id as number);
      if (msg["ok"] === true) p.resolve(msg);
      else p.reject(new HelperError(String(msg["error"] ?? "Unbekannter Fehler im Java-Helfer.")));
    }
  }

  private request(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let proc: ChildProcessWithoutNullStreams;
      try {
        proc = this.ensureStarted();
      } catch (e) {
        reject(e);
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      proc.stdin.write(JSON.stringify({ id, ...payload }) + "\n");
    });
  }
}
