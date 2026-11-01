<script lang="ts">
  import { onMount } from "svelte";
  import type { AppSession, OpenedExercise, StudentInfo } from "../../shared-types/api";
  import ExamBar from "./lib/ExamBar.svelte";
  import ExamProblem from "./lib/ExamProblem.svelte";
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

{#snippet content(s: AppSession)}
  {#if s.mode === "online" && !student}
    <Login
      notice={loginNotice}
      onLoggedIn={(st) => {
        student = st;
        loginNotice = "";
      }}
    />
  {:else if exercise}
    {#key exercise.id}
      <Workspace
        {exercise}
        canHandIn={s.mode === "online"}
        onBack={() => (exercise = undefined)}
        registerSession={(es) => (current = es)}
      />
    {/key}
  {:else}
    <ExerciseList {student} onOpen={open} />
    {#if error}
      <div class="toast" role="alert">{error}</div>
    {/if}
  {/if}
{/snippet}

{#if !session}
  <!-- waiting for main -->
{:else if session.mode === "exam"}
  {@const exam = session.exam}
  <div class="exam-root">
    {#if exam.status === "config-error"}
      <ExamBar title="J;DE" info={`Programmordner: ${exam.programDir}`} />
      <ExamProblem
        heading="Die Prüfung kann nicht starten"
        text="Die Datei exam.json ist fehlerhaft. Bitte gib deiner Lehrkraft Bescheid."
        label="Fehler in exam.json"
        lines={[exam.message]}
        tone="error"
        footer="Für die Lehrkraft: exam.json im Programmordner korrigieren und J;DE neu starten."
      />
    {:else}
      <ExamBar title={exam.title} info={`Abgabelaufwerk: ${exam.handInPath} · kein Internet nötig`} />
      {#if exam.status === "no-jdk"}
        <ExamProblem
          heading="Java 25 wurde nicht gefunden"
          text="J;DE braucht ein JDK 25 oder neuer, um deine Programme zu übersetzen und auszuführen. Bitte gib deiner Lehrkraft Bescheid."
          label="Gesucht in dieser Reihenfolge"
          lines={exam.searched}
          tone="neutral"
          footer="Für die Lehrkraft: JAVA_HOME auf ein JDK 25 setzen oder jdkPath in exam.json eintragen, dann J;DE neu starten."
        />
      {:else}
        <div class="exam-body">{@render content(session)}</div>
      {/if}
    {/if}
  </div>
{:else}
  {@render content(session)}
{/if}

<style>
  .exam-root {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .exam-body {
    flex: 1;
    min-height: 0;
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
