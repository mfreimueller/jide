<!-- Dialog in the style of the Abgeben confirmation: icon badge, heading, text, optional input, two buttons (Scratch, Figma 20-24). -->
<script lang="ts">
  import { onMount } from "svelte";

  let {
    heading,
    text = "",
    badge = "+",
    tone = "info",
    label,
    value = "",
    confirmLabel,
    onCancel,
    onSubmit,
    testid = "text-dialog"
  }: {
    heading: string;
    text?: string;
    badge?: string;
    tone?: "info" | "danger";
    /** With a label the dialog has a text input (focused, Enter confirms); without it is a plain confirmation. */
    label?: string;
    value?: string;
    confirmLabel: string;
    onCancel: () => void;
    /** Returns a German error message to show inline, or undefined when it worked (the caller closes the dialog). */
    onSubmit: (value: string) => Promise<string | undefined>;
    testid?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let input = $state(value);
  let error = $state("");
  let busy = $state(false);
  let field: HTMLInputElement | undefined = $state();
  const ready = $derived(!busy && (label === undefined || input.trim() !== ""));

  onMount(() => {
    field?.focus();
    field?.select();
  });

  async function submit(): Promise<void> {
    if (!ready) return;
    busy = true;
    error = "";
    try {
      error = (await onSubmit(input)) ?? "";
    } catch {
      error = "Das hat leider nicht geklappt.";
    } finally {
      busy = false;
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onCancel();
    else if (e.key === "Enter" && label !== undefined && e.target === field) {
      e.preventDefault();
      void submit();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" data-testid={testid}>
  <div class="dialog" role={label === undefined ? "alertdialog" : "dialog"} aria-labelledby="td-title" aria-describedby="td-text">
    <div class="dialog-icon" class:danger={tone === "danger"}>{badge}</div>
    <h1 id="td-title">{heading}</h1>
    {#if text}<p class="muted" id="td-text">{text}</p>{/if}
    {#if label !== undefined}
      <div class="field">
        <label for="td-input">{label}</label>
        <input id="td-input" bind:this={field} bind:value={input} type="text" autocomplete="off" spellcheck="false" data-testid="text-dialog-input" />
      </div>
    {/if}
    {#if error}<p class="error" role="alert" data-testid="text-dialog-error">{error}</p>{/if}
    <div class="dialog-actions">
      <button class="btn" onclick={onCancel} data-testid="text-dialog-cancel">Abbrechen</button>
      <button class="btn primary" onclick={() => void submit()} disabled={!ready} data-testid="text-dialog-confirm">{confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--overlay);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dialog {
    width: 460px;
    background: var(--bg-panel);
    border-radius: 14px;
    padding: 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  }
  .dialog-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--bg-selected);
    color: var(--text-link);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 700;
  }
  .dialog-icon.danger {
    background: var(--bg-err);
    color: var(--text-err);
  }
  h1 {
    margin: 0;
    font-size: 20px;
    color: var(--text);
  }
  .muted {
    margin: 0;
    font-size: 14px;
    line-height: 21px;
    color: var(--text-muted);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-2);
  }
  input {
    height: 38px;
    padding: 0 12px;
    font: inherit;
    font-size: 14px;
    color: var(--text);
    background: var(--bg-panel);
    border: 1.5px solid var(--border-strong);
    border-radius: 8px;
  }
  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .error {
    margin: 0;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 19px;
    background: var(--bg-err);
    border: 1px solid var(--border-err);
    color: var(--text-err);
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
  }
  .btn.primary:disabled {
    background: var(--primary-off);
    border-color: var(--primary-off);
    cursor: default;
  }
</style>
