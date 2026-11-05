<script lang="ts">
  import { onMount, tick } from "svelte";
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
    handInPath,
    autosaveMs,
    sessions
  }: {
    /** Exercises that loaded, in tab order (sorted by id). */
    exercises: ExerciseSummary[];
    allowTests: boolean;
    /** Hand-in drive; hand-in and autosave go there. */
    handInPath: string;
    /** Interval of the periodic autosave. */
    autosaveMs: number;
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
      if (current) void window.jide.examAutosave([active]).catch(() => undefined);
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

  // The tab row scrolls when the tabs do not fit; keep the active tab in view (each exercise has its own row).
  $effect(() => {
    if (!opened[active]) return;
    void tick().then(() =>
      document.querySelector(".slot:not(.hidden) .exam-tab.active")?.scrollIntoView({ inline: "nearest", block: "nearest" })
    );
  });

  /** Flushes all editors, then copies every opened exercise to the hand-in drive. */
  async function autosaveAll(): Promise<void> {
    await Promise.all([...sessions.values()].map((es) => es.flush().catch(() => undefined)));
    await window.jide.examAutosave().catch(() => undefined);
  }

  onMount(() => {
    if (exercises[0]) void show(exercises[0].id);
    const timer = setInterval(() => void autosaveAll(), autosaveMs);
    return () => clearInterval(timer);
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
          canHandIn={true}
          handInTarget={handInPath}
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
  /* As wide as the tabs, but never wider than the room left: then it scrolls sideways. */
  .exam-tabs {
    display: flex;
    gap: 8px;
    flex: 0 1 auto;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .exam-tab {
    flex: none;
    white-space: nowrap;
    height: 34px;
    padding: 0 14px;
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid var(--border-strong);
    background: var(--bg-panel);
    color: var(--text);
    cursor: pointer;
  }
  .exam-tab.active {
    background: var(--bg-selected-alt);
    border-color: var(--border-selected);
    color: var(--text-link);
  }
  .toast {
    position: fixed;
    right: 24px;
    bottom: 24px;
    background: var(--bg-dark);
    color: #fff;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 14px;
  }
</style>
