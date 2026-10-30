<!--
  Action buttons on the right side of the workspace top bar:
  Ausführen / Stopp (T6); Testen (M3) and Abgeben (M2) follow.
-->
<script lang="ts">
  import type { RunController } from "./run.svelte";

  let { run }: { run: RunController } = $props();
</script>

<div class="toolbar">
  <button class="btn run" disabled={run.state !== "idle"} onclick={() => void run.start()} data-testid="run">
    ▶ Ausführen
  </button>
  <button class="btn stop" disabled={run.state !== "running"} onclick={() => run.stop()} data-testid="stop">
    ■ Stopp
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .btn.run {
    background: #e6f6ec;
    border-color: #b4e2c4;
    color: #18794e;
  }
  .btn:disabled {
    color: #b0b4ba;
    background: #f1f3f5;
    border-color: #d9dcdf;
    cursor: default;
  }
</style>
