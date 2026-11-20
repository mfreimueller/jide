<script lang="ts">
  import { flushSync, onMount } from "svelte";
  import type { PanelInit, PanelState } from "../../../shared-types/panel-messages";
  import { SHORTCUT_PANEL } from "./layout.svelte";
  import AssignmentWindow from "./AssignmentWindow.svelte";
  import CodeWindow from "./CodeWindow.svelte";
  import ConsoleWindow from "./ConsoleWindow.svelte";
  import ProblemsWindow from "./ProblemsWindow.svelte";
  import TestsWindow from "./TestsWindow.svelte";

  /**
   * Root of the window of a detached panel (M10): waits for the full state of the main window, then shows
   * the one panel. The main window owns everything; this window only shows it and sends requests back.
   */
  const panel = window.jide.panels.window!;
  let init = $state.raw<PanelInit | undefined>();
  let current = $state.raw<PanelState | undefined>();

  // Alt+1/2/3 toggle the panels of the main window (the same keys as there). Capture phase, like in Workspace.
  function onShortcut(e: KeyboardEvent): void {
    const target = SHORTCUT_PANEL[e.code];
    if (!target || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) window.jide.panels.toOwner({ kind: "toggle-panel", panel: target });
  }

  onMount(() => {
    const stop = window.jide.panels.onFromOwner((m) => {
      if (m.kind === "init" && m.panel === panel) {
        init = m.init;
        current = m.init.state;
        flushSync(); // the panel is mounted before the next message (console ops) arrives
      } else if (m.kind === "state") {
        current = m.state;
      }
    });
    window.addEventListener("keydown", onShortcut, true);
    window.jide.panels.toOwner({ kind: "hello", panel });
    return () => {
      stop();
      window.removeEventListener("keydown", onShortcut, true);
    };
  });
</script>

{#if init && current}
  {#if panel === "code"}
    <CodeWindow {init} state={current} />
  {:else if panel === "assign"}
    <AssignmentWindow {init} state={current} />
  {:else if panel === "console"}
    <ConsoleWindow {init} state={current} />
  {:else if panel === "problems"}
    <ProblemsWindow {init} state={current} />
  {:else if panel === "tests"}
    <TestsWindow {init} state={current} />
  {/if}
{/if}
