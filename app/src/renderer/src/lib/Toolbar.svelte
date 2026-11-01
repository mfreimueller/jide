<!--
  Action buttons on the right side of the workspace top bar:
  Ausführen / Stopp (T6), Testen (M3, only with tests), Abgeben (online mode).
-->
<script lang="ts">
  import type { RunController } from "./run.svelte";
  import type { TestController } from "./test.svelte";

  let {
    run,
    tests,
    handIn
  }: {
    run: RunController;
    /** Only for exercises that have tests. */
    tests?: TestController;
    /** Online mode only. */
    handIn?: { label: string; busy: boolean; onClick: () => void };
  } = $props();
</script>

<div class="toolbar">
  <button class="btn run" disabled={run.state !== "idle" || tests?.state === "running"} onclick={() => void run.start()} data-testid="run">
    ▶ Ausführen
  </button>
  <button class="btn stop" disabled={run.state !== "running"} onclick={() => run.stop()} data-testid="stop">
    ■ Stopp
  </button>
  {#if tests}
    <button
      class="btn"
      disabled={run.state !== "idle" || tests.state === "running"}
      onclick={() => void tests.start()}
      data-testid="test"
    >
      ✓ Testen
    </button>
  {/if}
  {#if handIn}
    <button class="btn primary" disabled={handIn.busy} onclick={handIn.onClick} data-testid="hand-in">
      {handIn.busy ? "Wird abgegeben …" : handIn.label}
    </button>
  {/if}
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
  .btn.primary:disabled {
    color: #fff;
    background: #a9bdf0;
    border-color: #a9bdf0;
  }
  .btn:disabled:not(.primary) {
    color: #b0b4ba;
    background: #f1f3f5;
    border-color: #d9dcdf;
    cursor: default;
  }
</style>
