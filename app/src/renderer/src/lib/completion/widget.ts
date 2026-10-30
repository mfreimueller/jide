import type * as Monaco from "monaco-editor/editor/editor.api";

interface SuggestWidgetLike {
  onDidShow(listener: () => void): Monaco.IDisposable;
  toggleDetails(): void;
}

interface SuggestControllerLike {
  widget?: { value: SuggestWidgetLike };
}

/**
 * Opens the documentation panel next to the suggestion list (design screen 03 shows signature,
 * description and example beside the list). Monaco starts with the panel collapsed and has no
 * public option for it, so the widget is toggled once, the first time it is shown; Monaco
 * remembers the choice afterwards.
 *
 * Uses Monaco internals (the suggest controller contribution); if they change, the panel simply
 * stays collapsed and can still be opened with Ctrl+Leertaste.
 */
export function expandSuggestDetailsOnce(editor: Monaco.editor.IStandaloneCodeEditor): void {
  const controller = editor.getContribution("editor.contrib.suggestController") as unknown as SuggestControllerLike | null;
  const widget = controller?.widget?.value;
  if (!widget?.onDidShow || !widget.toggleDetails) return;
  const subscription = widget.onDidShow(() => {
    subscription.dispose();
    widget.toggleDetails();
  });
  editor.onDidDispose(() => subscription.dispose());
}
