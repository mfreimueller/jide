<script lang="ts">
  import "@xterm/xterm/css/xterm.css";
  import { onMount } from "svelte";
  import type { ConsoleTerm } from "./console-term";

  let { term, visible }: { term: ConsoleTerm; visible: boolean } = $props();
  let host: HTMLDivElement;

  onMount(() => {
    term.open(host);
    const observer = new ResizeObserver(() => term.refit());
    observer.observe(host);
    // The code font may arrive after the terminal measured its characters.
    void document.fonts.load('13px "JetBrains Mono"').then(() => term.remeasure()).catch(() => undefined);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (visible) term.refit();
  });
</script>

<div class="console" class:hidden={!visible} data-testid="console">
  <div class="host" bind:this={host}></div>
</div>

<style>
  .console {
    height: 100%;
    background: #1c2024;
    padding: 10px 0 6px 16px;
  }
  .console.hidden {
    display: none;
  }
  .host {
    height: 100%;
  }
</style>
