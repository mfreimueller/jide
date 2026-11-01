<!-- Exam mode: closing with changes that were not handed in (same look as HandInDialog). -->
<script lang="ts">
  let { onStay, onLeave }: { onStay: () => void; onLeave: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onStay()} />

<div class="overlay" data-testid="close-dialog">
  <div class="dialog" role="alertdialog" aria-labelledby="cd-title" aria-describedby="cd-text">
    <div class="dialog-icon">!</div>
    <h1 id="cd-title">Wirklich beenden?</h1>
    <p class="muted" id="cd-text">Du hast deine letzten Änderungen noch nicht abgegeben.</p>
    <div class="dialog-actions">
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn" onclick={onStay} autofocus data-testid="close-stay">Weiterarbeiten</button>
      <button class="btn primary" onclick={onLeave} data-testid="close-leave">Trotzdem beenden</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(28, 32, 36, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dialog {
    width: 460px;
    background: #fff;
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
    background: #fff4d5;
    color: #ab6400;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 700;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    color: #1c2024;
  }
  .muted {
    margin: 0;
    font-size: 14px;
    line-height: 21px;
    color: #60646c;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
  }
</style>
