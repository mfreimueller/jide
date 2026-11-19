<!--
  Action buttons on the right side of the workspace top bar:
  Ausführen / Stopp (T6), Testen (M3, only with tests), Abgeben (online mode).
-->
<script lang="ts">
  import type { RunController } from "./run.svelte";
  import { MSG_TEST_BLOCKED, type TestController } from "./test.svelte";

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
    <!-- A disabled button gets no mouse events: the wrapper carries the tooltip (dark tooltip as in PanelButton). -->
    <span class="tipwrap" data-tip={run.state !== "idle" ? MSG_TEST_BLOCKED : undefined} data-testid="test-wrap">
      <button
        class="btn"
        disabled={run.state !== "idle" || tests.state === "running"}
        onclick={() => void tests.start()}
        data-testid="test"
      >
        ✓ Testen
      </button>
    </span>
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
  .tipwrap {
    position: relative;
    flex: none;
    display: inline-flex;
  }
  .tipwrap button:disabled {
    pointer-events: none; /* the wrapper gets the hover */
  }
  .tipwrap[data-tip]:hover::after {
    content: attr(data-tip);
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    width: 250px;
    background: var(--bg-dark);
    color: #fff;
    font-size: 12px;
    line-height: 16px;
    padding: 6px 10px;
    border-radius: 6px;
    pointer-events: none;
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
