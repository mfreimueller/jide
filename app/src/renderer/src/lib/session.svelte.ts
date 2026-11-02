import { flushSync } from "svelte";
import { monaco } from "./monaco";
import type { OpenedExercise, OpenedFile, OpenedImage } from "../../../shared-types/api";
import type { MarkerData } from "./diagnostics";

export const AUTOSAVE_DELAY_MS = 800;
export const READONLY_MESSAGE = "Diese Datei ist vorgegeben und kann nicht geändert werden.";

type Editor = monaco.editor.IStandaloneCodeEditor;

/**
 * State of one opened exercise: tabs, one Monaco model per file and autosave.
 * Models are kept for the whole session so undo history survives tab switches.
 */
export class EditorSession {
  readonly files: OpenedFile[];
  /** Read-only SVG images; their paths can be open tabs (and `active`) next to the Java files. */
  readonly images: OpenedImage[];
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
    this.images = exercise.images;
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

  isImage(path: string): boolean {
    return this.images.some((i) => i.path === path);
  }

  /** Active tab is a Java file (the editor is shown), not an image. */
  get editorVisible(): boolean {
    return !this.isImage(this.active);
  }

  /** Tab / list label of a file or image. */
  label(path: string): string {
    return this.images.find((i) => i.path === path)?.title || path;
  }

  /** Shows an image in place of the editor. The editor and its models stay as they are. */
  private openImage(path: string): void {
    this.leaveJava();
    if (!this.openTabs.includes(path)) this.openTabs.push(path);
    this.active = path;
  }

  /** Remembers view state and saves the current Java file before another tab takes over. */
  private leaveJava(): void {
    if (this.active && !this.isImage(this.active) && this.editor) {
      this.viewStates.set(this.active, this.editor.saveViewState());
      void this.flush(this.active); // save immediately when switching tabs
    }
  }

  openFile(path: string): void {
    if (this.isImage(path)) return this.openImage(path);
    const model = this.models.get(path);
    if (!model || !this.editor) return;
    if (this.active !== path) this.leaveJava();
    const fromImage = this.isImage(this.active);
    if (!this.openTabs.includes(path)) this.openTabs.push(path);
    this.active = path;
    if (fromImage) {
      // Show the editor again before restoring the view, so scrolling to a line uses the real size.
      flushSync();
      this.editor.layout();
    }
    this.editor.setModel(model);
    this.editor.updateOptions({
      readOnly: !this.isEditable(path),
      readOnlyMessage: { value: READONLY_MESSAGE }
    });
    const vs = this.viewStates.get(path);
    if (vs) this.editor.restoreViewState(vs);
    this.editor.focus();
  }

  /** Opens the file and puts the cursor at the given position (Probleme list, exception links). */
  openAt(path: string, line: number, column = 1): void {
    const model = this.models.get(path);
    if (!model || !this.editor) return;
    this.openFile(path);
    const pos = model.validatePosition({ lineNumber: line, column });
    this.editor.setPosition(pos);
    this.editor.revealPositionInCenter(pos);
    this.editor.focus();
  }

  /** Current editor contents of all files (not the saved ones). */
  fileContents(): { path: string; content: string }[] {
    return this.files.map((f) => ({ path: f.path, content: this.models.get(f.path)?.getValue() ?? f.content }));
  }

  /** Number of lines of the student's code in a file (a trailing line break does not start a new line). */
  lineCount(path: string): number {
    const model = this.models.get(path);
    if (!model) return 0;
    const n = model.getLineCount();
    return n > 1 && model.getLineLength(n) === 0 ? n - 1 : n;
  }

  /** Sets the markers of every file; files not in the map get none. */
  setMarkers(owner: string, byFile: Map<string, MarkerData[]>): void {
    for (const [path, model] of this.models) {
      const markers = (byFile.get(path) ?? []).map((m) => {
        const r = model.validateRange(
          new monaco.Range(m.startLineNumber, m.startColumn, m.endLineNumber, m.endColumn)
        );
        return {
          severity: m.severity,
          message: m.message,
          startLineNumber: r.startLineNumber,
          startColumn: r.startColumn,
          endLineNumber: r.endLineNumber,
          endColumn: r.endColumn
        };
      });
      monaco.editor.setModelMarkers(model, owner, markers);
    }
  }

  /** Called after every edit of an editable file (auto-compile hooks in here). */
  onContentChange: (() => void) | undefined;

  private onEdit(path: string): void {
    this.onContentChange?.();
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
