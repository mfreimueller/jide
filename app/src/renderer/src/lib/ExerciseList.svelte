<script lang="ts">
  import { onMount } from "svelte";
  import iconUrl from "../assets/icon.svg";
  import { formatDate, formatDateTime, isPast } from "../../../shared-types/datetime";
  import { sectionExercises } from "../../../shared-types/grouping";
  import type { ExerciseList, ExerciseSummary, StudentInfo } from "../../../shared-types/api";

  let { student, onOpen }: { student: StudentInfo | null; onOpen: (id: string) => void } = $props();

  let list = $state<ExerciseList | undefined>();
  let failure = $state("");

  const initials = $derived(
    (student?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("")
  );
  const sections = $derived(sectionExercises(list?.exercises ?? [], list?.groups ?? []));

  onMount(async () => {
    // Opening the list is also the quiet retry after being offline.
    try {
      list = await window.jide.listExercises();
    } catch {
      failure = "Die Aufgaben konnten nicht geladen werden.";
      list = { exercises: [], groups: [], errors: [], offline: false };
    }
    // Tell main that the start screen is on screen (smoke test).
    requestAnimationFrame(() => window.jide.notifyEditorReady());
  });

  function late(ex: ExerciseSummary): boolean {
    return ex.status !== "abgegeben" && isPast(ex.deadline);
  }
</script>

{#snippet row(ex: ExerciseSummary)}
  <div class="ex" data-testid="exercise" data-id={ex.id}>
    <div class="ex-main">
      <span class="ex-title">{ex.title}</span>
      {#if ex.submittedAt}
        <span class="muted">Zuletzt abgegeben: {formatDateTime(ex.submittedAt)}</span>
      {/if}
    </div>
    <div class="meta">
      {#if ex.deadline}<span class="small">bis {formatDate(ex.deadline)}</span>{/if}
      {#if ex.status === "abgegeben"}
        <span class="chip" class:done={!ex.late} class:late-hand={ex.late}>{ex.late ? "Abgegeben · verspätet" : "Abgegeben"}</span>
      {:else if late(ex)}
        <span class="chip late">Frist vorbei · Abgabe noch möglich</span>
      {:else if ex.status === "neu"}
        <span class="chip new">Neu</span>
      {:else}
        <span class="chip wip">In Arbeit</span>
      {/if}
    </div>
    {#if ex.status === "neu"}
      <button class="btn primary" onclick={() => onOpen(ex.id)}>Öffnen</button>
    {:else if ex.status === "abgegeben"}
      <button class="btn" onclick={() => onOpen(ex.id)}>Ansehen</button>
    {:else}
      <button class="btn" onclick={() => onOpen(ex.id)}>Weiterarbeiten</button>
    {/if}
  </div>
{/snippet}

<div class="screen">
  <div class="topbar">
    <img class="logo-mark" src={iconUrl} alt="J;DE" />
    <span class="title">Meine Aufgaben</span>
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
    {#if student}
      <span class="user" data-testid="student"><span class="avatar">{initials}</span>{student.name}</span>
    {/if}
  </div>
  <div class="content">
    {#if list}
      {#if list.offline}
        <div class="notice" data-testid="offline-hint">Offline – du siehst die zuletzt geladenen Aufgaben.</div>
      {/if}
      {#each sections as section (section.key)}
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
      {#if list.exercises.length === 0 && !failure && list.errors.length === 0}
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
    {/if}
  </div>
</div>

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
