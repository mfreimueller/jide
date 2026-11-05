<script lang="ts">
  import { onMount } from "svelte";
  import ExamCard from "./ExamCard.svelte";
  import { startFooter } from "./exam-ui";

  /** Exam start screen (Figma 07): the student types their name; asked at every start. */
  let {
    title,
    handInPath,
    count,
    allowTests,
    errors,
    onStart
  }: {
    title: string;
    handInPath: string;
    /** Number of exercises that loaded. */
    count: number;
    allowTests: boolean;
    /** Loading errors of broken exercise folders (German). */
    errors: string[];
    onStart: (name: string) => Promise<string | undefined>;
  } = $props();

  let name = $state("");
  let busy = $state(false);
  let error = $state("");
  let input: HTMLInputElement;
  const ready = $derived(name.trim().length > 0 && count > 0 && !busy);

  onMount(() => {
    input.focus();
    // Tell main that a screen has rendered (smoke test).
    requestAnimationFrame(() => window.jide.notifyEditorReady());
  });

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (!ready) return;
    busy = true;
    error = "";
    try {
      error = (await onStart(name.trim())) ?? "";
    } catch {
      error = "Das hat leider nicht geklappt.";
    } finally {
      busy = false;
    }
  }
</script>

<ExamCard heading={title} footer={startFooter(count, allowTests)} testid="exam-start">
  {#snippet intro()}Gib deinen Namen ein. Deine Arbeit wird laufend auf dein Abgabelaufwerk <strong>{handInPath}</strong> gesichert.{/snippet}
  <form class="form" onsubmit={submit}>
    <div class="field">
      <label class="label" for="exam-name">Vor- und Nachname</label>
      <input
        id="exam-name"
        bind:this={input}
        bind:value={name}
        class="input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        data-testid="exam-name"
      />
    </div>
    {#if error}
      <p class="problem" role="alert">{error}</p>
    {/if}
    {#if errors.length > 0}
      <div class="problem" role="alert" data-testid="load-errors">
        {#each errors as err, i (i)}<p>{err}</p>{/each}
      </div>
    {/if}
    <button class="btn primary big" type="submit" disabled={!ready} data-testid="exam-start-button">Prüfung starten</button>
  </form>
</ExamCard>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-2);
  }
  .input {
    height: 44px;
    border: 1.5px solid var(--border-strong);
    border-radius: 8px;
    padding: 0 12px;
    font: inherit;
    font-size: 15px;
    color: var(--text);
    background: var(--bg-panel);
  }
  .input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .btn.big {
    height: 44px;
    font-size: 16px;
    padding: 0 22px;
    justify-content: center;
  }
  .btn:disabled {
    background: var(--primary-off);
    border-color: var(--primary-off);
    cursor: default;
  }
  .problem {
    margin: 0;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 19px;
    background: var(--bg-err);
    border: 1px solid var(--border-err);
    color: var(--text-err);
  }
  .problem p {
    margin: 0;
  }
</style>
