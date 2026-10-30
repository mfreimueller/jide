<script lang="ts">
  import { onMount } from "svelte";
  import { monaco } from "./lib/monaco";
  import { SAMPLE_JAVA } from "./lib/sample";

  let container: HTMLDivElement;

  onMount(() => {
    const editor = monaco.editor.create(container, {
      value: SAMPLE_JAVA,
      language: "java",
      fontFamily: "Cascadia Mono, Consolas, monospace",
      fontSize: 14,
      fontLigatures: false,
      minimap: { enabled: false },
      automaticLayout: true
    });
    window.jide.notifyEditorReady();
    return () => editor.dispose();
  });
</script>

<div class="editor" bind:this={container}></div>

<style>
  .editor {
    width: 100%;
    height: 100%;
  }
</style>
