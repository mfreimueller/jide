<script lang="ts">
  import type { PanelInit, PanelState } from "../../../shared-types/panel-messages";
  import AssignmentPanel from "./AssignmentPanel.svelte";

  let { init, state }: { init: PanelInit; state: PanelState } = $props();
  const a = $derived(state.assignment);
</script>

<div class="win">
  <AssignmentPanel
    windowed
    markdown={a.markdown}
    title={init.exercise.title}
    deadline={a.deadline}
    submittedAt={a.submittedAt}
    late={a.late}
    onpick={a.canPick ? () => window.jide.panels.toOwner({ kind: "pick-assignment" }) : undefined}
    ontoggle={() => undefined}
    onback={() => window.jide.panels.dock("assign")}
  />
</div>

<style>
  .win {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-panel);
  }
</style>
