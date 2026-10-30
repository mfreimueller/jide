<script lang="ts">
  import { onMount } from "svelte";
  import { monaco } from "./monaco";
  import type { EditorSession } from "./session.svelte";

  let { session }: { session: EditorSession } = $props();
  let container: HTMLDivElement;

  onMount(() => {
    const editor = monaco.editor.create(container, {
      model: null,
      theme: "jide-light",
      fontFamily: "Cascadia Mono, Consolas, monospace",
      fontSize: 14,
      fontLigatures: false,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false
    });
    session.attach(editor);
    return () => editor.dispose();
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
