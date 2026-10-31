<script lang="ts">
  import { onMount } from "svelte";
  import type { AppSession, OpenedExercise, StudentInfo } from "../../shared-types/api";
  import ExerciseList from "./lib/ExerciseList.svelte";
  import Login from "./lib/Login.svelte";
  import type { EditorSession } from "./lib/session.svelte";
  import Workspace from "./lib/Workspace.svelte";

  let exercise = $state<OpenedExercise | undefined>();
  let error = $state("");
  let current: EditorSession | undefined;
  let session = $state<AppSession | undefined>();
  let student = $state<StudentInfo | null>(null);
  let loginNotice = $state("");

  onMount(() => {
    // Main waits for this before the window closes.
    window.jide.onFlushRequest(async () => {
      await current?.flush();
    });
    // The server no longer accepts the stored code (main has deleted it): back to the login.
    const stop = window.jide.onSessionExpired(async (message) => {
      await current?.flush().catch(() => undefined); // edits are local; never lose them
      exercise = undefined;
      student = null;
      loginNotice = message;
    });
    void window.jide.getSession().then((s) => {
      session = s;
      if (s.mode === "online") student = s.student;
    });
    return stop;
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

{#if !session}
  <!-- waiting for main -->
{:else if session.mode === "online" && !student}
  <Login
    notice={loginNotice}
    onLoggedIn={(s) => {
      student = s;
      loginNotice = "";
    }}
  />
{:else if exercise}
  {#key exercise.id}
    <Workspace
      {exercise}
      canHandIn={session.mode === "online"}
      onBack={() => (exercise = undefined)}
      registerSession={(s) => (current = s)}
    />
  {/key}
{:else}
  <ExerciseList {student} onOpen={open} />
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
