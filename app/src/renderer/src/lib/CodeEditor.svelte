<script lang="ts">
  import { onMount } from "svelte";
  import { expandSuggestDetailsOnce } from "./completion/widget";
  import { CODE_FONT_FAMILY, codeFontReady, monaco } from "./monaco";
  import type { EditorSession } from "./session.svelte";

  let { session }: { session: EditorSession } = $props();
  let container: HTMLDivElement;

  onMount(() => {
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    let cancelled = false;
    // Create the editor only once the bundled code font is loaded, so Monaco measures
    // character widths with JetBrains Mono (otherwise cursor and selection drift).
    void codeFontReady.then(() => {
      if (cancelled) return;
      editor = monaco.editor.create(container, {
        model: null,
        theme: "jide-light",
        fontFamily: CODE_FONT_FAMILY,
        fontSize: 14,
        lineHeight: 22,
        fontLigatures: false,
        bracketPairColorization: { enabled: false },
        guides: { bracketPairs: false, highlightActiveBracketPair: false },
        wordBasedSuggestions: "off",
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false
      });
      monaco.editor.remeasureFonts();
      expandSuggestDetailsOnce(editor);
      session.attach(editor);
    });
    return () => {
      cancelled = true;
      editor?.dispose();
    };
  });
</script>

<div class="editor" bind:this={container}></div>

<style>
  .editor {
    flex: 1;
    min-height: 0;
    background: #fff;
  }
</style>
