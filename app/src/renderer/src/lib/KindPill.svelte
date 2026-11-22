<!-- Category pill of an exercise card (Pflicht / Übung / Bonus). -->
<script lang="ts">
  let { kind }: { kind: "pflicht" | "uebung" | "bonus" } = $props();

  const LABELS = { pflicht: "Pflicht", uebung: "Übung", bonus: "Bonus" } as const;
</script>

<span class="kind {kind}" data-testid="kind" data-kind={kind}>{LABELS[kind]}</span>

<style>
  .kind {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
    background: var(--bg);
    color: var(--c);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }
  .kind.pflicht {
    --c: var(--kind-pflicht);
    --bg: var(--kind-pflicht-bg);
  }
  .kind.uebung {
    --c: var(--kind-uebung);
    --bg: var(--kind-uebung-bg);
  }
  .kind.bonus {
    --c: var(--kind-bonus);
    --bg: var(--kind-bonus-bg);
  }
</style>
