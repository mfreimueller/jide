import { monaco } from "./monaco";
import type { CommentZone } from "../../../shared-types/grade";

type Editor = monaco.editor.IStandaloneCodeEditor;

interface Placed {
  zone: monaco.editor.IViewZone;
  id: string;
  box: HTMLElement;
}

/**
 * Line comments of a graded hand-in as Monaco view zones: a blue box below the commented line
 * (see `.jide-comment` in app.css). The height follows the text and is measured again when the editor is resized.
 */
export class CommentZones {
  private placed: Placed[] = [];
  private pending = 0;

  constructor(private readonly editor: Editor) {
    editor.onDidLayoutChange(() => this.schedule());
  }

  /** Replaces the zones (call after the editor got another model). */
  show(zones: CommentZone[]): void {
    this.clear();
    if (zones.length === 0) return;
    const padLeft = this.editor.getLayoutInfo().contentLeft + 32;
    this.editor.changeViewZones((acc) => {
      for (const z of zones) {
        const node = document.createElement("div");
        node.className = "jide-comment-zone";
        node.style.paddingLeft = `${padLeft}px`;
        const box = document.createElement("div");
        box.className = "jide-comment";
        box.setAttribute("data-testid", "line-comment");
        const mark = document.createElement("span");
        mark.className = "mark";
        mark.textContent = "\u{1F4AC}";
        const text = document.createElement("span");
        text.textContent = z.text; // never HTML
        box.append(mark, text);
        node.append(box);
        const zone: monaco.editor.IViewZone = { afterLineNumber: z.afterLine, heightInPx: 35, domNode: node };
        this.placed.push({ zone, id: acc.addZone(zone), box });
      }
    });
    this.schedule();
  }

  clear(): void {
    const old = this.placed;
    this.placed = [];
    if (old.length === 0) return;
    this.editor.changeViewZones((acc) => {
      for (const p of old) acc.removeZone(p.id);
    });
  }

  private schedule(): void {
    if (this.pending || this.placed.length === 0) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = 0;
      this.measure();
    });
  }

  private measure(): void {
    const placed = this.placed;
    this.editor.changeViewZones((acc) => {
      for (const p of placed) {
        const h = Math.ceil(p.box.getBoundingClientRect().height) + 8; // + the zone's vertical padding
        if (h > 8 && h !== p.zone.heightInPx) {
          p.zone.heightInPx = h;
          acc.layoutZone(p.id);
        }
      }
    });
  }
}
