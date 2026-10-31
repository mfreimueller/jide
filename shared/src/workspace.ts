import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExerciseError, type Exercise } from "./exercise.js";

export interface WorkspaceFile {
  path: string;
  content: string;
  editable: boolean;
}

export interface Workspace {
  dir: string;
  files: WorkspaceFile[];
}

function workspaceDir(exercise: Exercise, workspaceRoot: string): string {
  return path.join(workspaceRoot, exercise.id);
}

function requireEditable(exercise: Exercise, filePath: string): void {
  const entry = exercise.files.find((f) => f.path === filePath);
  if (!entry) {
    throw new ExerciseError(`Aufgabe "${exercise.id}": Datei ${filePath} gehört nicht zur Aufgabe.`);
  }
  if (!entry.editable) {
    throw new ExerciseError(`Aufgabe "${exercise.id}": Datei ${filePath} ist schreibgeschützt.`);
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Creates the workspace folder and copies editable files that do not exist yet. Never overwrites. */
export async function openWorkspace(exercise: Exercise, workspaceRoot: string): Promise<Workspace> {
  const dir = workspaceDir(exercise, workspaceRoot);
  await mkdir(dir, { recursive: true });
  const files: WorkspaceFile[] = [];
  for (const f of exercise.files) {
    if (!f.editable) {
      files.push({ path: f.path, content: exercise.originals[f.path]!, editable: false });
      continue;
    }
    const target = path.join(dir, f.path);
    if (!(await exists(target))) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(exercise.dir, "files", f.path), target);
    }
    files.push({ path: f.path, content: await readFile(target, "utf8"), editable: true });
  }
  return { dir, files };
}

/** Atomically writes an editable file (temp file + rename). */
export async function saveFile(
  exercise: Exercise,
  workspaceRoot: string,
  filePath: string,
  content: string,
): Promise<void> {
  requireEditable(exercise, filePath);
  const target = path.join(workspaceDir(exercise, workspaceRoot), filePath);
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, target);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

/** Restores one editable file to the exercise's original content. */
export async function resetFile(exercise: Exercise, workspaceRoot: string, filePath: string): Promise<void> {
  requireEditable(exercise, filePath);
  await saveFile(exercise, workspaceRoot, filePath, exercise.originals[filePath]!);
}
