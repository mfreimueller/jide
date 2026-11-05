<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import type { AppSession, ExerciseList as ExerciseListData, OpenedExercise, SaveStatus, StudentInfo } from "../../shared-types/api";
  import CloseDialog from "./lib/CloseDialog.svelte";
  import ExamBar from "./lib/ExamBar.svelte";
  import ExamProblem from "./lib/ExamProblem.svelte";
  import ExamStart from "./lib/ExamStart.svelte";
  import { saveStatusView } from "./lib/exam-ui";
  import ExamWorkspace from "./lib/ExamWorkspace.svelte";
  import ExerciseList from "./lib/ExerciseList.svelte";
  import Login from "./lib/Login.svelte";
  import type { EditorSession } from "./lib/session.svelte";
  import Workspace from "./lib/Workspace.svelte";

  let exercise = $state<OpenedExercise | undefined>();
  let error = $state("");
  // Editor sessions that may hold unsaved edits: one in online mode, one per opened exercise in exam mode.
  const sessions = new SvelteMap<string, EditorSession>();
  let session = $state<AppSession | undefined>();
  let student = $state<StudentInfo | null>(null);
  let loginNotice = $state("");
  // Exam mode: undefined while loading, null before "Prüfung starten".
  let examName = $state<string | null | undefined>();
  let examExercises = $state.raw<ExerciseListData | undefined>();
  // Exam mode: result of the last write to the hand-in drive; undefined before the first one.
  let saveStatus = $state<SaveStatus | undefined>();
  // Exam mode: closing with changes that were not handed in (main asks).
  let confirmClose = $state(false);

  async function flushAll(): Promise<void> {
    await Promise.all([...sessions.values()].map((es) => es.flush()));
  }

  async function loadExam(): Promise<void> {
    try {
      const [name, list] = await Promise.all([window.jide.getExamName(), window.jide.listExercises()]);
      examExercises = list;
      examName = name;
    } catch {
      examExercises = { exercises: [], groups: [], errors: ["Die Aufgaben konnten nicht geladen werden."], offline: false };
      examName = null;
    }
  }

  async function startExam(name: string): Promise<string | undefined> {
    const r = await window.jide.startExam(name);
    if (!r.ok) return r.message;
    examName = r.name;
    return undefined;
  }

  onMount(() => {
    // Main waits for this before the window closes.
    window.jide.onFlushRequest(async () => {
      await flushAll();
    });
    const stopStatus = window.jide.onSaveStatus((s) => (saveStatus = s));
    const stopClose = window.jide.onCloseConfirm(() => (confirmClose = true));
    // The server no longer accepts the stored code (main has deleted it): back to the login.
    const leaveToLogin = async (notice: string): Promise<void> => {
      await flushAll().catch(() => undefined); // edits are local; never lose them
      exercise = undefined;
      student = null;
      loginNotice = notice;
    };
    const stop = window.jide.onSessionExpired(leaveToLogin);
    const stopLoggedOut = window.jide.onLoggedOut(() => leaveToLogin(""));
    void window.jide.getSession().then((s) => {
      session = s;
      if (s.mode === "online") student = s.student;
      if (s.mode === "exam" && s.exam.status === "ok") void loadExam();
    });
    return () => {
      stop();
      stopLoggedOut();
      stopStatus();
      stopClose();
    };
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
        registerSession={(es) => (es ? sessions.set("current", es) : sessions.delete("current"))}
      />
    {/key}
  {:else}
    <ExerciseList {student} onOpen={open} />
    {#if error}
      <div class="toast" role="alert">{error}</div>
    {/if}
  {/if}
{/snippet}

{#if confirmClose}
  <CloseDialog
    onStay={() => {
      confirmClose = false;
      window.jide.answerClose(false);
    }}
    onLeave={() => {
      confirmClose = false;
      window.jide.answerClose(true);
    }}
  />
{/if}
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
      <ExamBar
        title={typeof examName === "string" ? examName : exam.title}
        info={typeof examName === "string" ? "" : `Abgabelaufwerk: ${exam.handInPath} · kein Internet nötig`}
        status={typeof examName === "string" ? saveStatusView(saveStatus, exam.handInPath) : undefined}
      />
      {#if exam.status === "no-jdk"}
        <ExamProblem
          heading="Java 25 wurde nicht gefunden"
          text="J;DE braucht ein JDK 25 oder neuer, um deine Programme zu übersetzen und auszuführen. Bitte gib deiner Lehrkraft Bescheid."
          label="Gesucht in dieser Reihenfolge"
          lines={exam.searched}
          tone="neutral"
          footer="Für die Lehrkraft: JAVA_HOME auf ein JDK 25 setzen oder jdkPath in exam.json eintragen, dann J;DE neu starten."
        />
      {:else if examName === undefined || !examExercises}
        <!-- loading -->
      {:else if examName === null}
        <ExamStart
          title={exam.title}
          handInPath={exam.handInPath}
          count={examExercises.exercises.length}
          allowTests={exam.allowTests}
          errors={examExercises.errors}
          onStart={startExam}
        />
      {:else}
        <div class="exam-body">
          <ExamWorkspace exercises={examExercises.exercises} allowTests={exam.allowTests} handInPath={exam.handInPath} autosaveMs={exam.autosaveMs} {sessions} />
        </div>
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
    background: var(--bg-dark);
    color: #fff;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 14px;
  }
</style>
