<!-- Confirmation before handing in code that has not passed its tests (design: "05 Abgeben – Bestätigung"). -->
<script lang="ts">
  let {
    summary,
    onCancel,
    onConfirm
  }: {
    /** Last test run if it is still current; null if never tested or the code changed since. */
    summary: { passed: number; total: number } | null;
    onCancel: () => void;
    onConfirm: () => void;
  } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onCancel()} />

<div class="overlay" data-testid="hand-in-dialog">
  <div class="dialog" role="alertdialog" aria-labelledby="hid-title" aria-describedby="hid-text">
    <div class="dialog-icon">!</div>
    <h1 id="hid-title">Wirklich abgeben?</h1>
    <p class="muted" id="hid-text">Da sind noch Fehler in deinem Programm. Möchtest du wirklich abgeben?</p>
    <div class="summary">
      {#if summary}<span data-testid="hand-in-dialog-count"><b>{summary.passed} von {summary.total}</b> Tests bestanden</span>{/if}
      <span class="small">Du kannst später noch einmal abgeben – es zählt die letzte Abgabe.</span>
    </div>
    <div class="dialog-actions">
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn" onclick={onCancel} autofocus data-testid="hand-in-cancel">Weiterarbeiten</button>
      <button class="btn primary" onclick={onConfirm} data-testid="hand-in-confirm">Trotzdem abgeben</button>
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
    background: var(--bg-warn);
    color: var(--text-warn);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
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
  .summary {
    background: var(--bg-app);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .small {
    font-size: 12px;
    color: var(--text-faint);
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
  }
</style>
