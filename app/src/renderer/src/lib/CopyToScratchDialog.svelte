<!-- "In Scratch kopieren": copies a server exercise into Scratch, from the starter code or from the student's code (Figma: Schüler-App 30). -->
<script lang="ts">
  let {
    exerciseId,
    title,
    testsLabel = "",
    onCancel,
    onCopied
  }: {
    exerciseId: string;
    title: string;
    /** Last test result when the caller knows it, e.g. "Tests: 3 / 5"; shown after "mit deinem aktuellen Stand". */
    testsLabel?: string;
    onCancel: () => void;
    /** Called after the copy exists; the dialog does not close itself. */
    onCopied: (newId: string) => void | Promise<void>;
  } = $props();

  let mode = $state<"fresh" | "mine">("mine");
  let error = $state("");
  let busy = $state(false);

  async function submit(): Promise<void> {
    if (busy) return;
    busy = true;
    error = "";
    try {
      const r = await window.jide.scratchCopyExercise(exerciseId, mode);
      if (!r.ok) error = r.message;
      else await onCopied(r.id);
    } catch {
      error = "Das hat leider nicht geklappt.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onCancel()} />

<div class="overlay" data-testid="copy-dialog">
  <div class="dialog" role="dialog" aria-labelledby="cd-title" aria-describedby="cd-text">
    <div class="dialog-icon">{"{ }"}</div>
    <h1 id="cd-title">In Scratch kopieren</h1>
    <p class="muted" id="cd-text">„{title}“ wird als eigenes Programm in Scratch kopiert – mit Angabe und Tests. Womit willst du starten?</p>
    <div class="options" role="radiogroup" aria-labelledby="cd-title">
      <label class="option" class:selected={mode === "fresh"}>
        <input type="radio" name="copy-mode" value="fresh" bind:group={mode} data-testid="copy-fresh" />
        <span class="option-text">
          <span class="option-title">Neu beginnen</span>
          <span class="option-sub">mit dem Startcode der Aufgabe</span>
        </span>
      </label>
      <label class="option" class:selected={mode === "mine"}>
        <input type="radio" name="copy-mode" value="mine" bind:group={mode} data-testid="copy-mine" />
        <span class="option-text">
          <span class="option-title">Mit meinem Code</span>
          <span class="option-sub">mit deinem aktuellen Stand{testsLabel ? ` (${testsLabel})` : ""}</span>
        </span>
      </label>
    </div>
    {#if error}<p class="error" role="alert" data-testid="copy-error">{error}</p>{/if}
    <div class="dialog-actions">
      <button class="btn" onclick={onCancel} data-testid="copy-cancel">Abbrechen</button>
      <button class="btn primary" onclick={() => void submit()} disabled={busy} data-testid="copy-confirm">Kopieren</button>
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
    font-family: var(--jide-code-font);
    font-size: 18px;
    font-weight: 700;
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
  .options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1.5px solid var(--border-strong);
    border-radius: 8px;
    cursor: pointer;
  }
  .option.selected {
    border-color: var(--primary);
    background: var(--bg-selected);
  }
  .option:has(input:focus-visible) {
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .option input {
    margin: 0;
    accent-color: var(--primary);
  }
  .option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .option-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }
  .option-sub {
    font-size: 13px;
    color: var(--text-muted);
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
