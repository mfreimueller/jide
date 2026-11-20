<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { OpenedExercise } from "../../../shared-types/api";
  import type { PanelInit, PanelState } from "../../../shared-types/panel-messages";
  import { BACK_LABEL } from "../../../shared-types/panel-windows";
  import CodeEditor from "./CodeEditor.svelte";
  import { markersByFile } from "./diagnostics";
  import ImageViewer from "./ImageViewer.svelte";
  import { MARKER_OWNER } from "./problems.svelte";
  import { EditorSession } from "./session.svelte";
  import Toolbar from "./Toolbar.svelte";

  let { init, state }: { init: PanelInit; state: PanelState } = $props();
  const send = window.jide.panels.toOwner;

  // The live editor of the exercise while Code is detached: the main window has none. This session holds
  // the text of the files; every edit goes to the main window, which saves, compiles and runs.
  // svelte-ignore state_referenced_locally
  const e = init.exercise;
  const exercise: OpenedExercise = {
    id: e.id,
    title: e.title,
    assignment: "",
    mainFile: e.mainFile,
    files: e.files,
    images: e.images,
    deadline: null,
    submittedAt: null,
    late: false,
    hasTests: false
  };
  const session = new EditorSession(exercise, true);
  session.onMirrorEdit = (path, content) => send({ kind: "edit", path, content });

  // The buttons do what the ones in the main window do: ask the main window.
  const run = {
    get state() {
      return state.runState;
    },
    start: () => send({ kind: "run" }),
    stop: () => send({ kind: "stop" })
  };
  const tests = $derived(
    state.tests
      ? {
          get state() {
            return state.tests?.state ?? "idle";
          },
          start: () => send({ kind: "test" })
        }
      : undefined
  );

  $effect(() => {
    session.applyTabs(state.openTabs, state.active);
  });
  $effect(() => {
    session.setMarkers(MARKER_OWNER, markersByFile(state.diagnostics));
  });
  // A markers update needs the models, which exist from the start; the editor shows them once attached.

  onMount(() =>
    window.jide.panels.onFromOwner((m) => {
      if (m.kind === "reveal") session.openAt(m.path, m.line, m.column);
    })
  );
  onDestroy(() => session.dispose());
</script>

<div class="screen">
  <div class="topbar">
    <span class="title">{init.exercise.title}</span>
    {#if state.saveState === "error"}
      <span class="status err" title={state.saveError} data-testid="save-status">Speichern fehlgeschlagen</span>
    {:else if state.saveState === "saving"}
      <span class="status" data-testid="save-status">Wird gespeichert …</span>
    {:else}
      <span class="status" data-testid="save-status">Gespeichert</span>
    {/if}
    <span class="spacer"></span>
    <Toolbar {run} {tests} />
    <button class="btn back" onclick={() => window.jide.panels.dock("code")} data-testid="panel-back">{BACK_LABEL}</button>
  </div>
  <div class="tabs" data-testid="tabs">
    {#each session.openTabs as p (p)}
      <button class="tab" class:active={session.active === p} onclick={() => send({ kind: "open-file", path: p })}>{session.label(p)}</button>
    {/each}
  </div>
  <CodeEditor {session} hidden={!session.editorVisible} />
  {#if !session.editorVisible}
    {#each session.images.filter((i) => i.path === session.active) as img (img.path)}
      <ImageViewer path={img.path} svg={img.svg} />
    {/each}
  {/if}
</div>

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-app);
  }
  .status {
    font-size: 12px;
    color: var(--text-faint);
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 100;
  }
  .status.err {
    color: var(--text-err);
  }
  .topbar .title {
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .back {
    flex: none;
    white-space: nowrap;
  }
  .tabs {
    height: 38px;
    flex: none;
    background: var(--bg-subtle);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-end;
    padding: 0 8px;
    gap: 2px;
  }
  .tab {
    font: inherit;
    font-size: 13px;
    border: none;
    background: none;
    padding: 8px 14px;
    border-radius: 6px 6px 0 0;
    color: var(--text-muted);
    cursor: pointer;
  }
  .tab.active {
    background: var(--bg-panel);
    color: var(--text);
    font-weight: 500;
  }
</style>
