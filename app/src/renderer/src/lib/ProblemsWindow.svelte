<script lang="ts">
  import type { PanelInit, PanelState } from "../../../shared-types/panel-messages";
  import PanelFrame from "./PanelFrame.svelte";
  import ProblemsBody from "./ProblemsBody.svelte";

  let { state }: { init: PanelInit; state: PanelState } = $props();
  const errors = $derived(state.diagnostics.filter((d) => d.severity === "error").length);
</script>

<PanelFrame panel="problems" title="Probleme" badge={errors > 0 ? String(errors) : undefined}>
  <ProblemsBody
    diagnostics={state.diagnostics}
    systemError={state.systemError}
    onopenat={(file, line, column) => window.jide.panels.toOwner({ kind: "open-at", path: file, line, column })}
  />
</PanelFrame>
