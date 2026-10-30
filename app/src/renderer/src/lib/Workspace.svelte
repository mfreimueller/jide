<script lang="ts">
  import { onDestroy } from "svelte";
  import type { OpenedExercise } from "../../../shared-types/api";
  import AssignmentPanel from "./AssignmentPanel.svelte";
  import BottomPanel, { type BottomTab } from "./BottomPanel.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import { LiveCompiler } from "./problems.svelte";
  import { EditorSession } from "./session.svelte";
  import Toolbar from "./Toolbar.svelte";

  let {
    exercise,
    onBack,
    registerSession
  }: {
    exercise: OpenedExercise;
    onBack: () => void;
    registerSession: (s: EditorSession | undefined) => void;
  } = $props();

  // The exercise never changes for the lifetime of this component (App re-mounts it).
  // svelte-ignore state_referenced_locally
  const session = new EditorSession(exercise);
  // svelte-ignore state_referenced_locally
  registerSession(session);
  // svelte-ignore state_referenced_locally
  const problems = new LiveCompiler(session, exercise.id);
  void problems.compileNow();
  let bottomTab = $state<BottomTab>("Konsole");
  const errorsByFile = $derived(problems.errorsByFile);
  onDestroy(() => {
    problems.dispose();
    registerSession(undefined);
    session.dispose();
  });

  let leaving = false;
  async function back(): Promise<void> {
    if (leaving) return;
    leaving = true;
    await session.flush();
    leaving = false;
    // Stay if saving failed: leaving would drop the unsaved text.
    if (session.clean) onBack();
  }
</script>

<div class="screen">
  <div class="topbar">
    <button class="btn ghost" onclick={back}>← Aufgaben</button>
    <span class="title">{exercise.title}</span>
    {#if session.saveState === "error"}
      <span class="status err" title={session.saveError} data-testid="save-status">Speichern fehlgeschlagen</span>
    {:else if session.saveState === "saving"}
      <span class="status" data-testid="save-status">Wird gespeichert …</span>
    {:else}
      <span class="status" data-testid="save-status">Gespeichert</span>
    {/if}
    <span class="spacer"></span>
    <Toolbar />
  </div>
  <div class="work">
    <div class="files" data-testid="file-list">
      <span class="pane-title">Dateien</span>
      {#each session.files as f (f.path)}
        <button
          class="file"
          class:active={session.active === f.path}
          onclick={() => session.openFile(f.path)}
        >
          <span class="java" class:ro={!f.editable}>J</span>{f.path}
          {#if !f.editable}<span class="lock">nur lesen</span>{/if}
          {#if errorsByFile.get(f.path)}<span class="err" data-testid="file-errors">{errorsByFile.get(f.path)}</span>{/if}
        </button>
      {/each}
    </div>
    <div class="center-col">
      <div class="tabs" data-testid="tabs">
        {#each session.openTabs as p (p)}
          <button class="tab" class:active={session.active === p} onclick={() => session.openFile(p)}>{p}</button>
        {/each}
      </div>
      <CodeEditor {session} />
      <BottomPanel bind:tab={bottomTab} {problems} {session} />
    </div>
    <AssignmentPanel markdown={exercise.assignment} />
  </div>
</div>

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f8f9fa;
  }
  .status {
    font-size: 12px;
    color: #80838d;
  }
  .status.err {
    color: #ce2c31;
  }
  .work {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .files {
    width: 210px;
    flex: none;
    box-sizing: border-box;
    background: #fff;
    border-right: 1px solid #e3e6e8;
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }
  .pane-title {
    font-size: 11px;
    font-weight: 600;
    color: #80838d;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 8px 8px;
  }
  .file {
    font: inherit;
    font-size: 13px;
    text-align: left;
    border: none;
    background: none;
    padding: 7px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #3a3f45;
    cursor: pointer;
  }
  .file.active {
    background: #e1e8fb;
    color: #2f5bd3;
    font-weight: 500;
  }
  .file .lock {
    margin-left: auto;
    font-size: 11px;
    color: #80838d;
  }
  .file .err {
    margin-left: auto;
    font-size: 11px;
    color: #fff;
    background: #e5484d;
    border-radius: 999px;
    padding: 0 6px;
  }
  .file .lock + .err {
    margin-left: 0;
  }
  .java {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: #f76b15;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .java.ro {
    background: #b0b4ba;
  }
  .center-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .tabs {
    height: 38px;
    flex: none;
    background: #f1f3f5;
    border-bottom: 1px solid #e3e6e8;
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
    color: #60646c;
    cursor: pointer;
  }
  .tab.active {
    background: #fff;
    color: #1c2024;
    font-weight: 500;
  }
</style>
