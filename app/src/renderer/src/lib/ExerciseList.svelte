<script lang="ts">
  import { onMount } from "svelte";
  import iconUrl from "../assets/icon.svg";
  import { formatDate, formatDateTime, isPast } from "../../../shared-types/datetime";
  import { sectionExercises } from "../../../shared-types/grouping";
  import CopyToScratchDialog from "./CopyToScratchDialog.svelte";
  import DifficultyPill from "./DifficultyPill.svelte";
  import GradeChip from "./GradeChip.svelte";
  import { gradeSubtitle } from "../../../shared-types/grade";
  import {
    HIDE_DISABLED_REASON,
    hiddenCount,
    hiddenExercises,
    hiddenState,
    hiddenSubtitle,
    isHidden,
    mayHide,
    type HideModes
  } from "../../../shared-types/hiding";
  import ScratchSection from "./ScratchSection.svelte";
  import type { ExerciseList, ExerciseSummary, StudentInfo } from "../../../shared-types/api";

  let {
    student,
    onOpen,
    scratchOnly = false,
    onLogin
  }: {
    student: StudentInfo | null;
    onOpen: (id: string) => void;
    /** Before login: only the Scratch section, no backend call. */
    scratchOnly?: boolean;
    /** Scratch-only list: back to the code screen. */
    onLogin?: () => void;
  } = $props();

  let list = $state<ExerciseList | undefined>();
  // Scratch items are reloaded on their own after create / rename / delete (no backend call).
  let scratchItems = $state<ExerciseSummary[]>([]);
  let failure = $state("");
  // "In Scratch kopieren": open ⋯ menu (exercise id) and the dialog for one exercise.
  let menuFor = $state<string | undefined>();
  let copying = $state.raw<ExerciseSummary | undefined>();
  // Hiding (T54): the student's own choices (only on this laptop) and the "Ausgeblendet" section.
  let modes = $state<HideModes>({});
  let showHidden = $state(false);
  // Evaluated when the list is loaded; the 7-day rule does not need to tick while the list is open.
  let now = $state(new Date());

  const initials = $derived(
    (student?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("")
  );
  const serverExercises = $derived((list?.exercises ?? []).filter((e) => !e.scratch));
  // Group counters ("1 / 2 abgegeben") count every exercise of the group, hidden ones included; only the cards are filtered.
  const sections = $derived(
    sectionExercises(serverExercises, list?.groups ?? [])
      .map((s) => ({ ...s, exercises: s.exercises.filter((e) => !isHidden(e, modes[e.id], now)) }))
      .filter((s) => s.exercises.length > 0)
  );
  const hidden = $derived(scratchOnly ? [] : hiddenExercises(serverExercises, modes, now));
  const serverCount = $derived(serverExercises.length);

  async function setMode(id: string, mode: "hidden" | "shown"): Promise<void> {
    try {
      modes = await window.jide.hiddenSet(id, mode);
    } catch {
      /* keep the list as it is */
    }
  }

  function openLabel(ex: ExerciseSummary): string {
    if (ex.grade || ex.status === "abgegeben") return "Ansehen";
    return ex.status === "neu" ? "Öffnen" : "Weiterarbeiten";
  }

  async function reloadScratch(): Promise<void> {
    try {
      scratchItems = (await window.jide.listScratch()).exercises;
    } catch {
      /* keep the items on screen */
    }
  }

  onMount(async () => {
    // Opening the list is also the quiet retry after being offline.
    try {
      list = await (scratchOnly ? window.jide.listScratch() : window.jide.listExercises());
      scratchItems = list.exercises.filter((e) => e.scratch);
      if (!scratchOnly) modes = await window.jide.hiddenGet().catch(() => ({}));
      now = new Date();
    } catch {
      failure = "Die Aufgaben konnten nicht geladen werden.";
      list = { exercises: [], groups: [], errors: [], offline: false };
    }
    // Tell main that the start screen is on screen (smoke test).
    requestAnimationFrame(() => window.jide.notifyEditorReady());
  });

  function late(ex: ExerciseSummary): boolean {
    return ex.status !== "abgegeben" && !ex.grade && isPast(ex.deadline);
  }
</script>

{#snippet row(ex: ExerciseSummary)}
  <div class="ex" data-testid="exercise" data-id={ex.id}>
    <div class="ex-main">
      <div class="ex-head">
        <span class="ex-title">{ex.title}</span>
        {#if ex.difficulty}<DifficultyPill level={ex.difficulty} />{/if}
      </div>
      {#if ex.grade}
        <span class="muted" data-testid="grade-subtitle">{gradeSubtitle(ex.grade.gradedAt)}</span>
      {:else if ex.submittedAt}
        <span class="muted">Zuletzt abgegeben: {formatDateTime(ex.submittedAt)}</span>
      {/if}
    </div>
    <div class="meta">
      {#if ex.deadline}<span class="small">bis {formatDate(ex.deadline)}</span>{/if}
      {#if ex.grade}
        <GradeChip symbol={ex.grade.symbol} />
      {:else if ex.status === "abgegeben"}
        <span class="chip" class:done={!ex.late} class:late-hand={ex.late}>{ex.late ? "Abgegeben · verspätet" : "Abgegeben"}</span>
      {:else if late(ex)}
        <span class="chip late">Frist vorbei · Abgabe noch möglich</span>
      {:else if ex.status === "neu"}
        <span class="chip new">Neu</span>
      {:else}
        <span class="chip wip">In Arbeit</span>
      {/if}
    </div>
    <div class="menu-wrap">
      <button
        class="btn icon-btn"
        aria-label="Mehr"
        aria-haspopup="menu"
        aria-expanded={menuFor === ex.id}
        onclick={(e) => {
          e.stopPropagation();
          menuFor = menuFor === ex.id ? undefined : ex.id;
        }}
        data-testid="exercise-menu"
      >⋯</button>
      {#if menuFor === ex.id}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
        <div class="menu" role="menu" onclick={(e) => e.stopPropagation()}>
          <button
            class="menu-item"
            role="menuitem"
            onclick={() => {
              menuFor = undefined;
              copying = ex;
            }}
            data-testid="exercise-copy"
          >In Scratch kopieren …</button>
          {#if !ex.scratch}
            {@const can = mayHide(ex, now)}
            <button
              class="menu-item"
              role="menuitem"
              disabled={!can}
              onclick={() => {
                menuFor = undefined;
                void setMode(ex.id, "hidden");
              }}
              data-testid="exercise-hide"
            >
              Ausblenden
              {#if !can}<span class="menu-reason">{HIDE_DISABLED_REASON}</span>{/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>
    <button class="btn" class:primary={!ex.grade && ex.status === "neu"} onclick={() => onOpen(ex.id)}>{openLabel(ex)}</button>
  </div>
{/snippet}

{#snippet hiddenRow(ex: ExerciseSummary)}
  {@const st = hiddenState(ex)}
  <div class="hrow" data-testid="hidden-exercise" data-id={ex.id}>
    <span class="hrow-title">{ex.title}</span>
    <span class="hrow-sub">{hiddenSubtitle(ex, list?.groups ?? [])}</span>
    <span class="spacer"></span>
    {#if st.kind === "graded" && ex.grade}
      <GradeChip symbol={ex.grade.symbol} />
    {:else if st.kind === "handed-in"}
      <span class="chip" class:done={!ex.late} class:late-hand={ex.late}>{ex.late ? "Abgegeben · verspätet" : "Abgegeben"}</span>
    {:else if st.kind === "late"}
      <span class="chip grey">Nicht abgegeben</span>
    {/if}
    <button class="btn small-btn" onclick={() => void setMode(ex.id, "shown")} data-testid="hidden-show">Wieder anzeigen</button>
    <button class="btn small-btn" class:primary={!ex.grade && ex.status === "neu"} onclick={() => onOpen(ex.id)}>{openLabel(ex)}</button>
  </div>
{/snippet}

<svelte:window
  onclick={() => (menuFor = undefined)}
  onkeydown={(e) => {
    if (e.key === "Escape") menuFor = undefined;
  }}
/>

<div class="screen">
  <div class="topbar">
    <img class="logo-mark" src={iconUrl} alt="J;DE" />
    <span class="title">{scratchOnly ? "Scratch" : "Meine Aufgaben"}</span>
    {#if student}
      <span class="chip grey" data-testid="course">{student.course.subject} · {student.course.className}</span>
    {/if}
    <span class="spacer"></span>
    {#if student && list}
      {#if list.offline}
        <span class="sync off" data-testid="sync"><span class="dot"></span>Offline</span>
      {:else}
        <span class="sync" data-testid="sync"><span class="dot"></span>Verbunden</span>
      {/if}
    {/if}
    {#if scratchOnly}
      <button class="btn primary" onclick={() => onLogin?.()} data-testid="scratch-login">Mit Code anmelden</button>
    {/if}
    {#if student}
      <span class="user" data-testid="student"><span class="avatar">{initials}</span>{student.name}</span>
    {/if}
  </div>
  <div class="content">
    {#if list}
      {#if list.offline}
        <div class="notice" data-testid="offline-hint">Offline – du siehst die zuletzt geladenen Aufgaben.</div>
      {/if}
      {#each scratchOnly ? [] : sections as section (section.key)}
        {#if section.title}
          <div class="section-head" data-testid="group-heading">
            <span class="section-title">{section.title}</span>
            {#if section.progress}<span class="progress">{section.progress}</span>{/if}
          </div>
        {/if}
        {#each section.exercises as ex (ex.id)}
          {@render row(ex)}
        {/each}
      {/each}
      {#if !scratchOnly && serverCount === 0 && !failure && list.errors.length === 0}
        <p class="muted">Keine Aufgaben vorhanden.</p>
      {/if}
      {#if failure}
        <div class="notice" data-testid="load-errors"><p>{failure}</p></div>
      {/if}
      {#if list.errors.length > 0}
        <div class="notice" data-testid="load-errors">
          {#each list.errors as err}
            <p>{err}</p>
          {/each}
        </div>
      {/if}
      {#if hidden.length > 0}
        <div class="hidden-box" data-testid="hidden-section">
          <div class="hidden-head">
            <span class="section-title">Ausgeblendet</span>
            <span class="progress" data-testid="hidden-count">{hiddenCount(hidden.length)}</span>
            <span class="spacer"></span>
            <button class="btn small-btn" aria-expanded={showHidden} onclick={() => (showHidden = !showHidden)} data-testid="hidden-toggle">
              {showHidden ? "Verbergen ▴" : "Anzeigen ▾"}
            </button>
          </div>
          {#if showHidden}
            <p class="hidden-hint">Beurteilte Aufgaben kommen 7 Tage nach der Beurteilung von selbst hierher. „Wieder anzeigen“ holt eine Aufgabe zurück in die Liste.</p>
            <div class="hidden-list">
              {#each hidden as ex (ex.id)}
                {@render hiddenRow(ex)}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <ScratchSection
        items={scratchItems}
        hint={scratchOnly ? "Nur auf diesem Laptop gespeichert" : "Deine eigenen Programme – ohne Abgabe"}
        {onOpen}
        onChanged={reloadScratch}
      />
    {/if}
  </div>
</div>

{#if copying}
  {@const ex = copying}
  <CopyToScratchDialog
    exerciseId={ex.id}
    title={ex.title}
    onCancel={() => (copying = undefined)}
    onCopied={async () => {
      copying = undefined;
      await reloadScratch();
    }}
  />
{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-app);
  }
  .content {
    flex: 1;
    padding: 32px 120px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 8px;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-top: 8px;
  }
  .section-head .section-title {
    margin-top: 0;
  }
  .progress {
    font-size: 13px;
    color: var(--text-faint);
  }
  .ex {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .ex-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ex-title {
    font-size: 16px;
    font-weight: 600;
  }
  .ex-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .meta {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .small {
    font-size: 12px;
    color: var(--text-faint);
  }
  .muted {
    color: var(--text-muted);
    font-size: 14px;
    line-height: 20px;
  }
  .sync {
    font-size: 12px;
    color: var(--text-ok);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sync .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #30a46c;
  }
  .sync.off {
    color: var(--text-faint);
  }
  .sync.off .dot {
    background: var(--icon-grey);
  }
  .user {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--text-2);
  }
  .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--bg-selected);
    color: var(--text-link);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }
  .menu-wrap {
    position: relative;
  }
  .icon-btn {
    width: 34px;
    padding: 0;
    justify-content: center;
    font-size: 18px;
    line-height: 1;
    color: var(--text-muted);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 20;
    min-width: 160px;
    background: var(--bg-panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
  }
  .menu-item {
    font: inherit;
    font-size: 14px;
    text-align: left;
    white-space: nowrap;
    border: none;
    background: none;
    padding: 8px 12px;
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
  }
  .menu-item:hover:not(:disabled) {
    background: var(--bg-subtle);
  }
  .menu-item:disabled {
    color: var(--text-faint);
    cursor: default;
  }
  .menu-reason {
    display: block;
    font-size: 11px;
    line-height: 15px;
    margin-top: 2px;
  }
  .hidden-box {
    border: 1px dashed var(--border-strong);
    border-radius: 12px;
    padding: 12px 16px;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hidden-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hidden-head .section-title {
    margin-top: 0;
  }
  .hidden-hint {
    margin: 0;
    font-size: 12px;
    color: var(--text-faint);
  }
  .hidden-list {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .hrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
  }
  .hrow + .hrow {
    border-top: 1px solid var(--border);
  }
  .hrow-title {
    font-size: 13px;
    font-weight: 600;
  }
  .hrow-sub {
    font-size: 12px;
    color: var(--text-faint);
  }
  .small-btn {
    height: 28px;
    padding: 0 10px;
    font-size: 12px;
  }
  .notice {
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--bg-warn);
    border: 1px solid var(--border-warn);
    color: var(--text-warn);
    font-size: 13px;
    line-height: 19px;
  }
  .notice p {
    margin: 0;
  }
</style>
