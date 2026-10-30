import { monaco } from "./monaco";
import type { OpenedExercise, OpenedFile } from "../../../shared-types/api";

export const AUTOSAVE_DELAY_MS = 800;
export const READONLY_MESSAGE = "Diese Datei ist vorgegeben und kann nicht geändert werden.";

type Editor = monaco.editor.IStandaloneCodeEditor;

/**
 * State of one opened exercise: tabs, one Monaco model per file and autosave.
 * Models are kept for the whole session so undo history survives tab switches.
 */
export class EditorSession {
  readonly files: OpenedFile[];
  openTabs = $state<string[]>([]);
  active = $state<string>("");
  saveState = $state<"saved" | "saving" | "error">("saved");
  saveError = $state("");

  private models = new Map<string, monaco.editor.ITextModel>();
  private viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private dirty = new Set<string>();
  private inFlight = 0;
  private chain: Promise<void> = Promise.resolve();
  private editor: Editor | undefined;
  private disposed = false;

  constructor(private readonly exercise: OpenedExercise) {
    this.files = exercise.files;
    for (const f of this.files) {
      const uri = monaco.Uri.from({ scheme: "jide", path: `/${exercise.id}/${f.path}` });
      const model = monaco.editor.createModel(f.content, "java", uri);
      this.models.set(f.path, model);
      if (f.editable) {
        model.onDidChangeContent(() => this.onEdit(f.path));
      }
    }
  }

  attach(editor: Editor): void {
    this.editor = editor;
    this.openFile(this.exercise.mainFile);
  }

  isEditable(path: string): boolean {
    return this.files.find((f) => f.path === path)?.editable ?? false;
  }

  openFile(path: string): void {
    const model = this.models.get(path);
    if (!model || !this.editor) return;
    if (this.active && this.active !== path) {
      this.viewStates.set(this.active, this.editor.saveViewState());
      void this.flush(this.active); // save immediately when switching tabs
    }
    if (!this.openTabs.includes(path)) this.openTabs.push(path);
    this.active = path;
    this.editor.setModel(model);
    this.editor.updateOptions({
      readOnly: !this.isEditable(path),
      readOnlyMessage: { value: READONLY_MESSAGE }
    });
    const vs = this.viewStates.get(path);
    if (vs) this.editor.restoreViewState(vs);
    this.editor.focus();
  }

  private onEdit(path: string): void {
    this.dirty.add(path);
    this.saveState = "saving";
    clearTimeout(this.timers.get(path));
    this.timers.set(
      path,
      setTimeout(() => void this.flush(path), AUTOSAVE_DELAY_MS)
    );
  }

  /** Saves the given file (or all dirty files) now. Resolves once the writes have finished. */
  flush(path?: string): Promise<void> {
    const paths = path ? [path] : [...this.dirty];
    for (const p of paths) {
      clearTimeout(this.timers.get(p));
      this.timers.delete(p);
      if (!this.dirty.has(p)) continue;
      const model = this.models.get(p);
      if (!model) continue;
      const content = model.getValue();
      this.dirty.delete(p);
      this.inFlight++;
      this.saveState = "saving";
      // Writes are serialized so an older save can never overwrite a newer one.
      this.chain = this.chain.then(async () => {
        let result;
        try {
          result = await window.jide.saveFile(this.exercise.id, p, content);
        } catch {
          result = { ok: false as const, message: "Die Datei konnte nicht gespeichert werden." };
        }
        this.inFlight--;
        if (result.ok) {
          this.finish();
        } else {
          this.dirty.add(p); // retry on next change or flush
          this.saveError = result.message;
          this.saveState = "error";
        }
      });
    }
    return this.chain;
  }

  private finish(): void {
    if (this.inFlight === 0 && this.dirty.size === 0) {
      this.saveState = "saved";
      this.saveError = "";
    }
  }

  /** True when everything is on disk. */
  get clean(): boolean {
    return this.dirty.size === 0 && this.saveState !== "error";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.editor?.setModel(null);
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
  }
}
