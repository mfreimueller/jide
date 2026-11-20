<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { PanelInit, PanelState } from "../../../shared-types/panel-messages";
  import Console from "./Console.svelte";
  import { ConsoleTerm } from "./console-term";
  import PanelFrame from "./PanelFrame.svelte";

  let { init, state }: { init: PanelInit; state: PanelState } = $props();

  // A copy of the console of the main window: it replays the history, then follows every change. What is
  // typed here goes straight to the running program (main) and, as an echo, to the main window's console.
  const term = new ConsoleTerm(
    // svelte-ignore state_referenced_locally
    () => state.files.map((f) => ({ path: f.path, lineCount: f.lineCount })),
    (path, line) => window.jide.panels.toOwner({ kind: "open-at", path, line })
  );
  term.onInputLine((line) => window.jide.sendInput(line));
  term.onOp = (op) => window.jide.panels.toOwner({ kind: "console-op", op });
  // svelte-ignore state_referenced_locally
  for (const op of init.consoleLog) term.applyOp(op);

  onMount(() =>
    window.jide.panels.onFromOwner((m) => {
      if (m.kind !== "console-op") return;
      term.applyOp(m.op);
      if (m.op.op === "running" && m.op.running) term.focus();
    })
  );
  onDestroy(() => term.dispose());
</script>

<PanelFrame panel="console" title="Konsole" dark>
  {#snippet extras()}
    <button class="btn ghost clear" onclick={() => window.jide.panels.toOwner({ kind: "clear-console" })} data-testid="clear-console">Leeren</button>
  {/snippet}
  <Console {term} visible={true} />
</PanelFrame>

<style>
  .clear {
    height: 26px;
    font-size: 12px;
  }
</style>
