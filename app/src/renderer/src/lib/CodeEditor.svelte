<script lang="ts">
  import { onMount } from "svelte";
  import { editorFont, editorLineHeight, startEditorFont } from "./editor-font.svelte";
  import { expandSuggestDetailsOnce } from "./completion/widget";
  import { CODE_FONT_FAMILY, codeFontReady, monaco, monacoThemeName } from "./monaco";
  import type { EditorSession } from "./session.svelte";

  let { session, hidden = false }: { session: EditorSession; hidden?: boolean } = $props();
  let container: HTMLDivElement;

  let live: monaco.editor.IStandaloneCodeEditor | undefined;
  // Menu changes (and the size arriving after the editor was created) reach every editor here.
  $effect(() => {
    const fontSize = editorFont.size;
    live?.updateOptions({ fontSize, lineHeight: editorLineHeight(fontSize) });
  });

  onMount(() => {
    startEditorFont();
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    let cancelled = false;
    // Create the editor only once the bundled code font is loaded, so Monaco measures
    // character widths with JetBrains Mono (otherwise cursor and selection drift).
    void codeFontReady.then(() => {
      if (cancelled) return;
      editor = monaco.editor.create(container, {
        model: null,
        theme: monacoThemeName(),
        fontFamily: CODE_FONT_FAMILY,
        fontSize: editorFont.size,
        lineHeight: editorLineHeight(editorFont.size),
        fontLigatures: false,
        bracketPairColorization: { enabled: false },
        guides: { bracketPairs: false, highlightActiveBracketPair: false },
        wordBasedSuggestions: "off",
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false
      });
      live = editor;
      monaco.editor.remeasureFonts();
      expandSuggestDetailsOnce(editor);
      session.attach(editor);
    });
    return () => {
      cancelled = true;
      live = undefined;
      if (editor) session.detachEditor(editor);
      editor?.dispose();
    };
  });
</script>

<div class="editor" class:hidden bind:this={container}></div>

<style>
  .editor {
    flex: 1;
    min-height: 0;
    background: var(--bg-panel);
  }
  /* Hidden, not unmounted, while an image is shown: models, undo history and view state stay alive. */
  .editor.hidden {
    display: none;
  }
</style>
