<script lang="ts">
  import { formatTime } from "../../../shared-types/datetime";
  import type { PanelInit, PanelState } from "../../../shared-types/panel-messages";
  import PanelFrame from "./PanelFrame.svelte";
  import TestsBody from "./TestsBody.svelte";
  import { allPassed } from "./test-state";

  let { state }: { init: PanelInit; state: PanelState } = $props();
  const tests = $derived(state.tests);
  const last = $derived(tests?.last);
  const ok = $derived(last ? allPassed(last.summary) : false);
  const badge = $derived(last ? (ok ? `${last.summary.passed}/${last.summary.total}` : String(last.summary.total - last.summary.passed)) : undefined);
</script>

<PanelFrame panel="tests" title="Tests" {badge} badgeOk={ok}>
  {#snippet extras()}
    {#if last && tests?.stale}
      <span class="chip late-hand" data-testid="tests-stale">Code geändert – bitte neu testen</span>
    {/if}
    {#if last}
      <span class="small" data-testid="tests-time">zuletzt getestet {formatTime(last.at)}</span>
    {/if}
  {/snippet}
  <TestsBody {last} onopenat={(line) => window.jide.panels.toOwner({ kind: "open-at", path: tests?.mainFile ?? "", line })} />
</PanelFrame>

<style>
  .small {
    font-size: 12px;
    color: var(--text-faint);
  }
</style>
