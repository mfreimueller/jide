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
    flex: none; /* the action buttons are never pushed out or squeezed */
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .toolbar .btn {
    flex: none;
    white-space: nowrap;
  }
  .btn.run {
    background: var(--bg-ok);
    border-color: var(--border-ok);
    color: var(--text-ok);
  }
  .btn.primary:disabled {
    color: #fff;
    background: var(--primary-off);
    border-color: var(--primary-off);
  }
  .btn:disabled:not(.primary) {
    color: var(--text-disabled);
    background: var(--bg-subtle);
    border-color: var(--border-strong);
    cursor: default;
  }
</style>
