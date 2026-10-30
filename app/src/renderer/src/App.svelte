<script lang="ts">
  import { onMount } from "svelte";
  import type { OpenedExercise } from "../../shared-types/api";
  import ExerciseList from "./lib/ExerciseList.svelte";
  import type { EditorSession } from "./lib/session.svelte";
  import Workspace from "./lib/Workspace.svelte";

  let exercise = $state<OpenedExercise | undefined>();
  let error = $state("");
  let current: EditorSession | undefined;

  onMount(() => {
    // Main waits for this before the window closes.
    window.jide.onFlushRequest(async () => {
      await current?.flush();
    });
  });

  async function open(id: string): Promise<void> {
    const result = await window.jide.openExercise(id);
    if (result.ok) {
      error = "";
      exercise = result.exercise;
    } else {
      error = result.message;
    }
  }
</script>

{#if exercise}
  {#key exercise.id}
    <Workspace
      {exercise}
      onBack={() => (exercise = undefined)}
      registerSession={(s) => (current = s)}
    />
  {/key}
{:else}
  <ExerciseList onOpen={open} />
  {#if error}
    <div class="toast" role="alert">{error}</div>
  {/if}
{/if}

<style>
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
