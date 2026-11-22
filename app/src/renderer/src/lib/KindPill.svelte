<!-- Difficulty pill of an exercise card (newbie / advanced / pro). -->
<script lang="ts">
  let { level }: { level: "newbie" | "advanced" | "pro" } = $props();

  const LEVELS = {
    newbie: { label: "Pflicht", bars: 1 },
    advanced: { label: "Advanced", bars: 2 },
    pro: { label: "Pro", bars: 3 }
  } as const;
  const info = $derived(LEVELS[level]);
</script>

<span class="diff {level}" data-testid="difficulty" data-level={level}>
  <span class="bars" aria-hidden="true">
    {#each [1, 2, 3] as n}<span class="bar b{n}" class:on={n <= info.bars}></span>{/each}
  </span>
  {info.label}
</span>

<style>
  .diff {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 9px 2px 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
    background: var(--bg);
    color: var(--c);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }
  .diff.newbie {
    --c: var(--diff-newbie);
    --bg: var(--diff-newbie-bg);
  }
  .diff.advanced {
    --c: var(--diff-advanced);
    --bg: var(--diff-advanced-bg);
  }
  .diff.pro {
    --c: var(--diff-pro);
    --bg: var(--diff-pro-bg);
  }
  .bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;
  }
  .bar {
    width: 3px;
    border-radius: 1px;
    background: var(--c);
    opacity: 0.25;
  }
  .bar.on {
    opacity: 1;
  }
  .b1 {
    height: 6px;
  }
  .b2 {
    height: 9px;
  }
  .b3 {
    height: 12px;
  }
</style>
