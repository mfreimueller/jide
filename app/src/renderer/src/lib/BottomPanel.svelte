<script lang="ts">
  // Placeholders: Konsole (T6), Probleme (T5), Tests (M3) fill these later.
  const tabs = ["Konsole", "Probleme", "Tests"] as const;
  let active = $state<(typeof tabs)[number]>("Konsole");
</script>

<div class="bottom">
  <div class="btabs">
    {#each tabs as t}
      <button class="btab" class:active={active === t} onclick={() => (active = t)}>{t}</button>
    {/each}
  </div>
  <div class="body" class:console={active === "Konsole"} data-testid="bottom-{active}"></div>
</div>

<style>
  .bottom {
    height: 230px;
    flex: none;
    border-top: 1px solid #e3e6e8;
    background: #fff;
    display: flex;
    flex-direction: column;
  }
  .btabs {
    height: 36px;
    flex: none;
    border-bottom: 1px solid #e3e6e8;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 4px;
  }
  .btab {
    font: inherit;
    font-size: 13px;
    padding: 6px 12px;
    border: none;
    background: none;
    border-radius: 6px;
    color: #60646c;
    cursor: pointer;
  }
  .btab.active {
    background: #f1f3f5;
    color: #1c2024;
    font-weight: 500;
  }
  .body {
    flex: 1;
  }
  .body.console {
    background: #1c2024;
  }
</style>
