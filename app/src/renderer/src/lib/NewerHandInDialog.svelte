<!-- Online mode: a hand-in from another device is newer than the unsubmitted code on this laptop (same look as CloseDialog). -->
<script lang="ts">
  import { formatDateTime } from "../../../shared-types/datetime";

  let {
    submittedAt,
    busy = false,
    onLoad,
    onKeep
  }: { submittedAt: string; busy?: boolean; onLoad: () => void; onKeep: () => void } = $props();
</script>

<div class="overlay" data-testid="newer-hand-in-dialog">
  <div class="dialog" role="alertdialog" aria-labelledby="nhd-title" aria-describedby="nhd-text">
    <div class="dialog-icon">!</div>
    <h1 id="nhd-title">Neuere Abgabe von einem anderen Gerät</h1>
    <p class="muted" id="nhd-text" data-testid="newer-hand-in-text">
      Du hast {formatDateTime(submittedAt)} auf einem anderen Gerät abgegeben. Dein Code hier ist anders. Möchtest du die Abgabe laden? Dein
      Code hier wird dann ersetzt.
    </p>
    <div class="dialog-actions">
      <button class="btn" onclick={onKeep} disabled={busy} data-testid="newer-hand-in-keep">Meinen Stand behalten</button>
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn primary" onclick={onLoad} disabled={busy} autofocus data-testid="newer-hand-in-load">Abgabe laden</button>
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
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
  }
</style>
