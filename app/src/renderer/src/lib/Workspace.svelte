<script lang="ts">
  import { onDestroy, onMount, type Snippet } from "svelte";
  import type { OpenedExercise, ReportEnv } from "../../../shared-types/api";
  import { formatDate, formatDateTime, formatTime } from "../../../shared-types/datetime";
  import { commentCounts, feedbackDate } from "../../../shared-types/grade";
  import CopyToScratchDialog from "./CopyToScratchDialog.svelte";
  import GradeChip from "./GradeChip.svelte";
  import { handInToast } from "./exam-ui";
  import AssignmentPanel from "./AssignmentPanel.svelte";
  import BottomPanel, { type BottomTab } from "./BottomPanel.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import ImageViewer from "./ImageViewer.svelte";
  import { layout, openBottom, SHORTCUT_PANEL, togglePanel } from "./layout.svelte";
  import {
    BOTTOM_BAR_HEIGHT,
    BOTTOM_MIN,
    clampSize,
    maxBottomHeight,
    maxSideWidth,
    SIDE_MIN,
    STRIP_WIDTH
  } from "./panel-layout";
  import PanelButton from "./PanelButton.svelte";
  import PanelStrip from "./PanelStrip.svelte";
  import ResizeHandle from "./ResizeHandle.svelte";
  import { LiveCompiler } from "./problems.svelte";
  import { RunController } from "./run.svelte";
  import { TestController } from "./test.svelte";
  import HandInDialog from "./HandInDialog.svelte";
  import { EditorSession } from "./session.svelte";
  import BugReportDialog from "./BugReportDialog.svelte";
  import { buildReport, reasonLabel, reportFileName } from "./bug-report";
  import { eventLog } from "./event-log";
  import { editableContents, getLastTest, handInReason, planHandIn, type HandInPlan, type HandInReason } from "./test-state";
  import Toolbar from "./Toolbar.svelte";
  import TextDialog from "./TextDialog.svelte";
  import { canDeleteClass } from "./scratch-ui";

  let {
    exercise,
    canHandIn,
    onBack,
    registerSession,
    leading,
    assignmentHeading,
    allowTests = true,
    handInTarget
  }: {
    exercise: OpenedExercise;
    /** Online mode: show "Abgeben". */
    canHandIn: boolean;
    onBack: () => void;
    registerSession: (s: EditorSession | undefined) => void;
    /** Exam mode: replaces "← Aufgaben" and the title in the top bar (the exercise tabs). */
    leading?: Snippet;
    /** Exam mode: heading of the assignment panel ("Aufgabe 1: …"). */
    assignmentHeading?: string;
    /** Exam mode with `allowTests: false` passes false: no "Testen", no Tests tab. */
    allowTests?: boolean;
    /** Exam mode: the hand-in drive ("P:\"), named in the success toast. */
    handInTarget?: string;
  } = $props();

  // The exercise never changes for the lifetime of this component (App re-mounts it).
  // svelte-ignore state_referenced_locally
  const session = new EditorSession(exercise);
  // svelte-ignore state_referenced_locally
  registerSession(session);
  // svelte-ignore state_referenced_locally
  const problems = new LiveCompiler(session, exercise.id);
  // A graded hand-in is only read: nothing is compiled or run.
  // svelte-ignore state_referenced_locally
  const graded = exercise.graded;
  if (!graded) void problems.compileNow();
  // svelte-ignore state_referenced_locally
  const lineCommentCounts = commentCounts(graded?.lineComments ?? []);
  let copying = $state(false);
  let bottomTab = $state<BottomTab>("Konsole");
  // svelte-ignore state_referenced_locally
  const run = new RunController(session, problems, exercise.id, exercise.mainFile, (t) => (bottomTab = t));
  // svelte-ignore state_referenced_locally
  const tests = exercise.hasTests && allowTests
    ? new TestController(session, problems, run, exercise.id, exercise.mainFile, (t) => (bottomTab = t))
    : undefined;
  const errorsByFile = $derived(problems.errorsByFile);
  onDestroy(() => {
    tests?.dispose();
    run.dispose();
    problems.dispose();
    registerSession(undefined);
    session.dispose();
  });

  // svelte-ignore state_referenced_locally
  let submittedAt = $state<string | null>(exercise.submittedAt);
  // svelte-ignore state_referenced_locally
  let late = $state(exercise.late);
  let handInBusy = $state(false);
  let toast = $state<{ kind: "ok" | "error"; text: string } | undefined>();
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(toastTimer));

  function showToast(kind: "ok" | "error", text: string): void {
    toast = { kind, text };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = undefined), 8000);
  }

  let confirming = $state.raw<{ plan: HandInPlan; reason: HandInReason } | undefined>();
  /** The bug report (T44) on top of the confirmation; the text is fixed when it was opened. */
  let reportText = $state<string | undefined>();
  let reportName = $state("");
  // The exam has no bug report: its hand-in target (the drive) is only given in exam mode.
  const canReport = $derived(handInTarget === undefined);

  async function openReport(): Promise<void> {
    const decision = confirming;
    if (!decision) return;
    const now = new Date();
    let env: ReportEnv = { appVersion: "unbekannt", os: "unbekannt", mode: "online", packageVersion: null };
    try {
      env = await window.jide.reportEnv(exercise.id);
    } catch {
      // the report is still useful without the environment line
    }
    const last = getLastTest(exercise.id);
    reportName = reportFileName(exercise.id, now);
    reportText = buildReport({
      now,
      env,
      exerciseId: exercise.id,
      hasTests: exercise.hasTests,
      allowTests,
      testState: tests?.state ?? "idle",
      programRunning: run.state !== "idle",
      last: last && { at: last.at, summary: last.summary, snapshot: last.snapshot },
      current: editableContents(session.files, session.fileContents()),
      decision: { reason: decision.reason, confirm: decision.plan.confirm, summary: decision.plan.summary },
      events: eventLog.list()
    });
  }

  // Scratch programs: add / delete classes, pick the Angabe.
  // svelte-ignore state_referenced_locally
  const scratch = exercise.scratch === true;
  // svelte-ignore state_referenced_locally
  let assignmentMd = $state(exercise.assignment);
  let classDialog = $state.raw<{ kind: "add" } | { kind: "delete"; path: string } | undefined>();

  async function addClass(name: string): Promise<string | undefined> {
    const r = await window.jide.scratchAddClass(exercise.id, name);
    if (!r.ok) return r.message;
    const opened = await window.jide.openExercise(exercise.id);
    const file = opened.ok ? opened.exercise.files.find((f) => f.path === r.path) : undefined;
    if (file) {
      session.addFile(file);
      session.openFile(file.path);
      void problems.compileNow();
    }
    classDialog = undefined;
    return undefined;
  }

  async function deleteClass(path: string): Promise<string | undefined> {
    const r = await window.jide.scratchDeleteClass(exercise.id, path);
    if (!r.ok) return r.message;
    session.removeFile(path);
    void problems.compileNow();
    classDialog = undefined;
    return undefined;
  }

  async function pickAssignment(): Promise<void> {
    try {
      const r = await window.jide.scratchChooseAssignment(exercise.id);
      if (!r.ok) return showToast("error", r.message);
      if (r.canceled) return;
      const opened = await window.jide.openExercise(exercise.id);
      if (opened.ok) assignmentMd = opened.exercise.assignment;
    } catch {
      showToast("error", "Das hat leider nicht geklappt.");
    }
  }

  /** Flushes pending edits; asks first if the tests do not vouch for the code (SPEC 3.5), then uploads. */
  async function handIn(): Promise<void> {
    if (handInBusy || confirming) return;
    handInBusy = true;
    eventLog.add("Abgeben gedrückt");
    try {
      await session.flush();
      if (!session.clean) {
        eventLog.add("Abgeben abgebrochen: Änderungen nicht gespeichert");
        showToast("error", "Deine Änderungen konnten nicht gespeichert werden. Versuch es gleich nochmal.");
        return;
      }
      const current = editableContents(session.files, session.fileContents());
      const hasTests = exercise.hasTests && allowTests;
      const last = getLastTest(exercise.id);
      const plan = planHandIn(hasTests, last, current);
      const reason = handInReason(hasTests, last, current);
      eventLog.add(
        `Entscheidung: ${plan.confirm ? "nachfragen" : "nicht nachfragen"} (${reasonLabel(reason)}), Ergebnis an Abgabe: ${
          plan.summary ? `${plan.summary.passed} von ${plan.summary.total}` : "keins"
        }`
      );
      if (plan.confirm) {
        confirming = { plan, reason };
        return;
      }
      await upload(plan);
    } catch {
      showToast("error", "Das hat leider nicht geklappt.");
    } finally {
      handInBusy = false;
    }
  }

  async function confirmHandIn(): Promise<void> {
    const plan = confirming?.plan;
    confirming = undefined;
    if (!plan || handInBusy) return;
    eventLog.add("Nachfrage: Trotzdem abgeben");
    handInBusy = true;
    try {
      await upload(plan);
    } catch {
      showToast("error", "Das hat leider nicht geklappt.");
    } finally {
      handInBusy = false;
    }
  }

  async function upload(plan: HandInPlan): Promise<void> {
    const r = await window.jide.handIn(exercise.id, plan.summary);
    if (r.ok) {
      submittedAt = r.submittedAt;
      late = r.late;
      showToast(
        "ok",
        handInTarget !== undefined
          ? handInToast(handInTarget, r.submittedAt)
          : r.late
          ? `Abgabe gespeichert – verspätet (${formatDateTime(r.submittedAt)})`
          : `Abgabe gespeichert – ${formatDateTime(r.submittedAt)}`
      );
    } else {
      showToast("error", r.message);
    }
  }

  /** "Abgegeben 10:44" for today, "Abgegeben Do, 12.11." otherwise. */
  function handInChip(iso: string): string {
    const today = formatDate(new Date().toISOString()) === formatDate(iso);
    return `Abgegeben${late ? " · verspätet" : ""} ${today ? formatTime(iso) : formatDate(iso)}`;
  }

  // Panel layout (T29): the sizes live in the shared `layout`; here are only the container sizes for the limits.
  let screenEl: HTMLDivElement;
  let workWidth = $state(0);
  let centerHeight = $state(0);
  let dragStart = 0;

  const sideWidth = (collapsed: boolean, width: number): number => (collapsed ? STRIP_WIDTH : width);
  function dragFiles(delta: number): void {
    const max = maxSideWidth(workWidth, sideWidth(layout.assignCollapsed, layout.assignWidth));
    layout.filesWidth = clampSize(dragStart + delta, SIDE_MIN, max);
  }
  function dragAssign(delta: number): void {
    const max = maxSideWidth(workWidth, sideWidth(layout.filesCollapsed, layout.filesWidth));
    layout.assignWidth = clampSize(dragStart - delta, SIDE_MIN, max);
  }
  function dragBottom(delta: number): void {
    layout.bottomHeight = clampSize(dragStart - delta, BOTTOM_MIN, maxBottomHeight(centerHeight));
  }

  // Alt+1/2/3 toggle the panels. The listener sits on window in the capture phase, so Monaco and the
  // console (xterm) never see the key. Every mounted Workspace listens (the exam keeps one per tab),
  // but only the visible one reacts, so a key toggles exactly once.
  function onShortcut(e: KeyboardEvent): void {
    const panel = SHORTCUT_PANEL[e.code];
    if (!panel || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!screenEl || screenEl.getClientRects().length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) togglePanel(panel);
  }
  onMount(() => {
    window.addEventListener("keydown", onShortcut, true);
    return () => window.removeEventListener("keydown", onShortcut, true);
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

<div class="screen" bind:this={screenEl}>
  {#if confirming && reportText !== undefined}
    <BugReportDialog report={reportText} fileName={reportName} onClose={() => (reportText = undefined)} />
  {:else if confirming}
    <HandInDialog
      summary={confirming.plan.summary}
      onCancel={() => {
        eventLog.add("Nachfrage: Weiterarbeiten");
        confirming = undefined;
      }}
      onConfirm={() => void confirmHandIn()}
      onReport={canReport ? () => void openReport() : undefined}
    />
  {/if}
  {#if classDialog?.kind === "add"}
    <TextDialog
      heading="Neue Klasse"
      label="Name der Klasse"
      confirmLabel="Erstellen"
      onCancel={() => (classDialog = undefined)}
      onSubmit={addClass}
      testid="class-dialog"
    />
  {:else if classDialog?.kind === "delete"}
    {@const path = classDialog.path}
    <TextDialog
      heading={`„${path}“ löschen?`}
      text="Die Datei wird von diesem Laptop gelöscht."
      badge="!"
      tone="danger"
      confirmLabel="Löschen"
      onCancel={() => (classDialog = undefined)}
      onSubmit={() => deleteClass(path)}
      testid="class-dialog"
    />
  {/if}
  {#if copying && graded}
    <CopyToScratchDialog
      exerciseId={exercise.id}
      title={exercise.title}
      onCancel={() => (copying = false)}
      onCopied={() => {
        copying = false;
        showToast("ok", "In Scratch kopiert – du findest es unter „Scratch“ in der Aufgabenliste.");
      }}
    />
  {/if}
  <div class="topbar">
    {#if leading}
      {@render leading()}
    {:else}
      <button class="btn ghost" onclick={back}>← Aufgaben</button>
      <span class="title">{exercise.title}</span>
      {#if scratch}<span class="chip grey" data-testid="scratch-chip">Scratch</span>{/if}
      {#if graded}<GradeChip symbol={graded.symbol} />{/if}
    {/if}
    {#if graded}
      <span class="status" data-testid="graded-status">Abgegeben: {formatDateTime(graded.submittedAt)} · nur lesen</span>
    {:else if session.saveState === "error"}
      <span class="status err" title={session.saveError} data-testid="save-status">Speichern fehlgeschlagen</span>
    {:else if session.saveState === "saving"}
      <span class="status" data-testid="save-status">Wird gespeichert …</span>
    {:else}
      <span class="status" data-testid="save-status">Gespeichert</span>
    {/if}
    {#if submittedAt && !graded}
      <span class="chip" class:done={!late} class:late-hand={late} data-testid="handed-in">{handInChip(submittedAt)}</span>
    {/if}
    <span class="spacer"></span>
    {#if graded}
      <button class="btn" onclick={() => (copying = true)} data-testid="copy-to-scratch">In Scratch kopieren …</button>
    {:else}
      <Toolbar
        {run}
        {tests}
        handIn={canHandIn
          ? { label: submittedAt ? "Erneut abgeben" : "Abgeben", busy: handInBusy, onClick: () => void handIn() }
          : undefined}
      />
    {/if}
  </div>
  <div class="work" bind:clientWidth={workWidth}>
    {#if layout.filesCollapsed}
      <PanelStrip side="left" label="Dateien" tip="Dateien aufklappen (Alt+1)" onclick={() => togglePanel("files")} testid="files" />
    {/if}
    <div class="files" class:collapsed={layout.filesCollapsed} style:width="{layout.filesWidth}px" data-testid="file-list">
      <div class="pane-head">
        <span class="pane-title">Dateien</span>
        {#if scratch}
          <PanelButton icon="plus" tip="Neue Klasse" place="below-right" onclick={() => (classDialog = { kind: "add" })} testid="add-class" />
        {/if}
        <PanelButton icon="left" tip="Dateien einklappen (Alt+1)" onclick={() => togglePanel("files")} testid="files-collapse" />
      </div>
      <div class="file-scroll">
      {#each session.files as f (f.path)}
        <button
          class="file"
          class:active={session.active === f.path}
          onclick={() => session.openFile(f.path)}
        >
          <span class="java" class:ro={!f.editable}>J</span>{f.path}
          {#if !f.editable}<span class="lock">nur lesen</span>{/if}
          {#if errorsByFile.get(f.path)}<span class="err" data-testid="file-errors">{errorsByFile.get(f.path)}</span>{/if}
          {#if lineCommentCounts.get(f.path)}<span class="badge" data-testid="file-comments" title="Kommentare in dieser Datei">💬 {lineCommentCounts.get(f.path)}</span>{/if}
          {#if scratch && canDeleteClass(f.path, exercise.mainFile, exercise.importedFiles)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <span
              class="del"
              role="button"
              tabindex="-1"
              aria-label={`${f.path} löschen`}
              onclick={(e) => {
                e.stopPropagation();
                classDialog = { kind: "delete", path: f.path };
              }}
              data-testid="delete-class">×</span
            >
          {/if}
        </button>
      {/each}
      {#each session.images as img (img.path)}
        <button
          class="file"
          class:active={session.active === img.path}
          onclick={() => session.openFile(img.path)}
          data-testid="image-file"
        >
          <span class="java img">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">
              <rect x="0.8" y="0.8" width="8.4" height="8.4" rx="1" />
              <path d="M1.5 8 L4 4.8 L5.8 6.8 L7 5.6 L8.6 8" />
            </svg>
          </span>{session.label(img.path)}
        </button>
      {/each}
      </div>
    </div>
    {#if !layout.filesCollapsed}
      <ResizeHandle dir="col" begin={() => (dragStart = layout.filesWidth)} apply={dragFiles} testid="files-handle" />
    {/if}
    <div class="center-col" bind:clientHeight={centerHeight}>
      <div class="tabs" data-testid="tabs">
        {#each session.openTabs as p (p)}
          <button class="tab" class:active={session.active === p} onclick={() => session.openFile(p)}>{session.label(p)}</button>
        {/each}
      </div>
      {#if graded && graded.comment.trim() !== ""}
        <div class="feedback" data-testid="feedback">
          <div class="feedback-head">
            <span class="feedback-title">Rückmeldung</span>
            <span class="feedback-date">{feedbackDate(graded.gradedAt)}</span>
          </div>
          <p class="feedback-text" data-testid="feedback-text">{graded.comment}</p>
        </div>
      {/if}
      <CodeEditor {session} hidden={!session.editorVisible} />
      {#if !session.editorVisible}
        {#each session.images.filter((i) => i.path === session.active) as img (img.path)}
          <ImageViewer path={img.path} svg={img.svg} />
        {/each}
      {/if}
      {#if !graded}
        {#if !layout.bottomCollapsed}
          <ResizeHandle dir="row" begin={() => (dragStart = layout.bottomHeight)} apply={dragBottom} testid="bottom-handle" />
        {/if}
        <BottomPanel
          bind:tab={bottomTab}
          {problems}
          {session}
          {run}
          {tests}
          collapsed={layout.bottomCollapsed}
          height={layout.bottomHeight}
          ontoggle={() => togglePanel("bottom")}
          onopen={openBottom}
        />
      {/if}
      {#if toast}
        <div
          class="toast"
          class:error={toast.kind === "error"}
          style:bottom="{graded ? 20 : (layout.bottomCollapsed ? BOTTOM_BAR_HEIGHT : layout.bottomHeight) + 20}px"
          role="status"
          data-testid="toast"
        >
          <span class="mark">{toast.kind === "ok" ? "✓" : "!"}</span>{toast.text}
        </div>
      {/if}
    </div>
    {#if !layout.assignCollapsed}
      <ResizeHandle dir="col" begin={() => (dragStart = layout.assignWidth)} apply={dragAssign} testid="assign-handle" />
    {/if}
    <AssignmentPanel
      markdown={assignmentMd}
      onpick={scratch ? () => void pickAssignment() : undefined}
      heading={assignmentHeading}
      title={exercise.title}
      deadline={exercise.deadline}
      {submittedAt}
      {late}
      collapsed={layout.assignCollapsed}
      width={layout.assignWidth}
      ontoggle={() => togglePanel("assign")}
    />
  </div>
</div>

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-app);
  }
  /* Too little room: the status gives way first, then the title; both stay on one line. */
  .status {
    font-size: 12px;
    color: var(--text-faint);
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 100;
  }
  .topbar .title {
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .topbar .btn.ghost {
    flex: none;
    white-space: nowrap;
  }
  .status.err {
    color: var(--text-err);
  }
  .work {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .files {
    flex: none;
    box-sizing: border-box;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
  }
  .files.collapsed {
    display: none;
  }
  .file-scroll {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }
  .pane-head {
    display: flex;
    align-items: center;
    padding: 0 0 4px;
  }
  .pane-title {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 8px;
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
    color: var(--text-2);
    cursor: pointer;
  }
  .file.active {
    background: var(--bg-selected);
    color: var(--text-link);
    font-weight: 500;
  }
  .file .lock {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-faint);
  }
  .file .err {
    margin-left: auto;
    font-size: 11px;
    color: #fff;
    background: #e5484d;
    border-radius: 999px;
    padding: 0 6px;
  }
  .file .del {
    margin-left: auto;
    display: none;
    width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 15px;
    line-height: 1;
    color: var(--text-faint);
  }
  .file:hover .del,
  .file:focus-within .del {
    display: flex;
  }
  .file .del:hover {
    background: var(--bg-err);
    color: var(--text-err);
  }
  .file .badge {
    margin-left: auto;
    font-size: 11px;
    line-height: 16px;
    color: var(--text-link);
    background: var(--bg-selected);
    border-radius: 999px;
    padding: 0 6px;
  }
  .file.active .badge {
    background: var(--bg-panel);
  }
  .feedback {
    flex: none;
    background: var(--feedback-bg);
    border-bottom: 1px solid var(--border);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .feedback-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .feedback-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }
  .feedback-date {
    font-size: 12px;
    color: var(--text-faint);
  }
  .feedback-text {
    margin: 0;
    font-size: 14px;
    line-height: 21px;
    color: var(--text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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
  .java.img {
    background: var(--icon-img);
  }
  .java.ro {
    background: var(--icon-grey);
  }
  .center-col {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .toast {
    position: absolute;
    right: 24px;
    background: var(--bg-dark);
    color: #fff;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 14px;
    display: flex;
    gap: 10px;
    align-items: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }
  .toast .mark {
    color: #7ce2a6;
    font-weight: 700;
  }
  .toast.error .mark {
    color: #ffb4b6;
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
