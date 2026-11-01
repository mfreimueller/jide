<script lang="ts">
  import { onMount } from "svelte";
  import type { ExerciseSummary, OpenedExercise } from "../../../shared-types/api";
  import { assignmentHeading, tabLabel } from "./exam-ui";
  import type { EditorSession } from "./session.svelte";
  import Workspace from "./Workspace.svelte";

  /**
   * Exam workspace (Figma 08): one tab button per exercise in the top bar, no exercise list.
   * Every exercise gets its own Workspace, opened on first visit and kept (hidden) afterwards,
   * so open files, undo history and the last test result survive switching.
   */
  let {
    exercises,
    allowTests,
    sessions
  }: {
    /** Exercises that loaded, in tab order (sorted by id). */
    exercises: ExerciseSummary[];
    allowTests: boolean;
    /** App-level registry of the editor sessions (flush before closing). */
    sessions: Map<string, EditorSession>;
  } = $props();

  let opened = $state.raw<Record<string, OpenedExercise>>({});
  let active = $state("");
  let error = $state("");
  let switching = false;

  async function show(id: string): Promise<void> {
    if (switching || id === active) return;
    switching = true;
    try {
      // Leaving an exercise saves it first, as "← Aufgaben" does in online mode.
      const current = sessions.get(active);
      await current?.flush();
      if (current && !current.clean) return; // saving failed: leaving would drop the unsaved text
      if (!opened[id]) {
        const r = await window.jide.openExercise(id);
        if (!r.ok) {
          error = r.message;
          return;
        }
        opened = { ...opened, [id]: r.exercise };
      }
      error = "";
      active = id;
    } finally {
      switching = false;
    }
  }

  onMount(() => {
    if (exercises[0]) void show(exercises[0].id);
  });
</script>

{#snippet tabs()}
  <div class="exam-tabs" data-testid="exam-tabs">
    {#each exercises as ex, i (ex.id)}
      <button
        class="exam-tab"
        class:active={active === ex.id}
        aria-pressed={active === ex.id}
        title={ex.title}
        onclick={() => void show(ex.id)}
        data-testid="exam-tab"
      >
        {tabLabel(i)}
      </button>
    {/each}
  </div>
{/snippet}

<div class="exam-workspace">
  {#each exercises as ex, i (ex.id)}
    {#if opened[ex.id]}
      <div class="slot" class:hidden={active !== ex.id}>
        <Workspace
          exercise={opened[ex.id]!}
          canHandIn={false}
          onBack={() => undefined}
          registerSession={(es) => (es ? sessions.set(ex.id, es) : sessions.delete(ex.id))}
          leading={tabs}
          assignmentHeading={assignmentHeading(i, ex.title)}
          {allowTests}
        />
      </div>
    {/if}
  {/each}
  {#if error}
    <div class="toast" role="alert">{error}</div>
  {/if}
</div>

<style>
  .exam-workspace {
    height: 100%;
    position: relative;
  }
  .slot {
    height: 100%;
  }
  .slot.hidden {
    display: none;
  }
  .exam-tabs {
    display: flex;
    gap: 8px;
  }
  .exam-tab {
    height: 34px;
    padding: 0 14px;
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid #d9dcdf;
    background: #fff;
    color: #1c2024;
    cursor: pointer;
  }
  .exam-tab.active {
    background: #e8eefb;
    border-color: #c5d3f5;
    color: #2f5bd3;
  }
  .toast {
    position: fixed;
    right: 24px;
    bottom: 24px;
    background: #1c2024;
    color: #fff;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 14px;
  }
</style>
