import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { join, resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

const fixture = resolve(__dirname, "fixture", "server.mts");
const tsx = require.resolve("tsx/cli");

/** The online specs need the MariaDB of docker-compose.yml; without it they are skipped. */
export function dbReachable(port = 3307): Promise<boolean> {
  return new Promise((done) => {
    const s = createConnection({ port, host: "127.0.0.1" });
    s.once("connect", () => {
      s.destroy();
      done(true);
    });
    s.once("error", () => done(false));
  });
}

export interface Backend {
  url: string;
  /** The seeded student's code as printed on the slip, XXXX-XXXX. */
  code: string;
  /** Stops the server and drops its database. */
  stop: () => Promise<void>;
  /** Gives the student a new code (the old one stops working) and returns it. */
  resetCode: () => Promise<string>;
  /** Count and test summary of the student's last hand-in of an exercise, as the teacher matrix reads them. */
  handInCell: (exerciseId: string) => Promise<{ count: number; testSummary: { passed: number; total: number } | null } | null>;
}

const started: Backend[] = [];

export async function startBackend(): Promise<Backend> {
  const child: ChildProcess = spawn(process.execPath, [tsx, fixture], {
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, TZ: "UTC" }
  });
  const info = await new Promise<{ url: string; code: string }>((ok, fail) => {
    let buf = "";
    child.stdout!.on("data", (d: Buffer) => {
      buf += d.toString();
      const m = /^READY (.*)$/m.exec(buf);
      if (m) ok(JSON.parse(m[1]!));
    });
    child.once("exit", (c) => fail(new Error(`backend fixture exited with ${c}`)));
    setTimeout(() => fail(new Error("backend fixture did not start")), 30_000);
  });
  let stopped = false;
  const backend: Backend = {
    url: info.url,
    code: info.code,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      const exited = new Promise<void>((r) => child.once("exit", () => r()));
      child.kill("SIGTERM");
      await exited;
    },
    resetCode: async () => {
      const r = await fetch(`${info.url}/__test/reset-code`, { method: "POST" });
      return ((await r.json()) as { code: string }).code;
    },
    handInCell: async (exerciseId) => {
      const m = (await (await fetch(`${info.url}/__test/matrix`)).json()) as {
        exercises: { id: string }[];
        rows: { cells: ({ count: number; testSummary: { passed: number; total: number } | null } | null)[] }[];
      };
      const j = m.exercises.findIndex((e) => e.id === exerciseId);
      return m.rows[0]?.cells[j] ?? null;
    }
  };
  started.push(backend);
  return backend;
}

export async function stopAllBackends(): Promise<void> {
  for (const b of started.splice(0)) await b.stop();
}

/** Types the code into the login screen and presses "Anmelden". */
export async function login(page: Page, code: string): Promise<void> {
  await page.getByTestId("code-input").fill(code);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

export async function expectList(page: Page): Promise<void> {
  await expect(page.getByTestId("exercise").first()).toBeVisible();
}

export const handInDir = (userData: string): string => join(userData, "cache");
