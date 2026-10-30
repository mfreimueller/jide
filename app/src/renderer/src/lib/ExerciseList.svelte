<script lang="ts">
  import { onMount } from "svelte";
  import type { ExerciseList } from "../../../shared-types/api";

  let { onOpen }: { onOpen: (id: string) => void } = $props();

  let list = $state<ExerciseList | undefined>();
  let failure = $state("");

  onMount(async () => {
    try {
      list = await window.jide.listExercises();
    } catch {
      failure = "Die Aufgaben konnten nicht geladen werden.";
      list = { exercises: [], errors: [] };
    }
    // Tell main that the start screen is on screen (smoke test).
    requestAnimationFrame(() => window.jide.notifyEditorReady());
  });
</script>

<div class="screen">
  <div class="topbar">
    <div class="logo-mark">{"{ }"}</div>
    <span class="title">Meine Aufgaben</span>
  </div>
  <div class="content">
    {#if list}
      {#each list.exercises as ex (ex.id)}
        <div class="ex" data-testid="exercise" data-id={ex.id}>
          <div class="ex-main"><span class="ex-title">{ex.title}</span></div>
          {#if ex.status === "neu"}
            <span class="chip new">Neu</span>
            <button class="btn primary" onclick={() => onOpen(ex.id)}>Öffnen</button>
          {:else}
            <span class="chip wip">In Arbeit</span>
            <button class="btn" onclick={() => onOpen(ex.id)}>Weiterarbeiten</button>
          {/if}
        </div>
      {:else}
        {#if !failure && list.errors.length === 0}
          <p class="muted">Keine Aufgaben vorhanden.</p>
        {/if}
      {/each}
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
    background: #f8f9fa;
  }
  .content {
    flex: 1;
    padding: 32px 120px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  .ex {
    background: #fff;
    border: 1px solid #e3e6e8;
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
  .muted {
    color: #60646c;
    font-size: 14px;
    line-height: 20px;
  }
  .notice {
    margin-top: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    background: #fff4d5;
    border: 1px solid #ffdc8f;
    color: #ab6400;
    font-size: 13px;
    line-height: 19px;
  }
</style>
