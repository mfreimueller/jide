<script lang="ts">
  import type { DiffMode } from "@jide/shared/output-diff";
  import { diffNote, diffViewRows, type DiffSegment } from "./diff-view";

  // T34: expected vs. actual output of a failed io test, line by line (Figma screen 16).
  let { actual, expected, match }: { actual: string; expected: string; match: DiffMode } = $props();

  const rows = $derived(diffViewRows(actual, expected, match));
</script>

{#snippet cell(segs: DiffSegment[])}{#each segs as s}<span class={s.kind}>{s.text}</span>{/each}{/snippet}

<div class="diff" data-testid="test-diff">
  <div class="head">ERWARTET</div>
  <div class="head">DEINE AUSGABE</div>
  <div class="head"></div>
  {#each rows as r}
    <div class="cell exp {r.kind}" data-testid="diff-row" data-kind={r.kind}>{@render cell(r.expected)}</div>
    <div class="cell act {r.kind}">{@render cell(r.actual)}</div>
    <div class="tag {r.kind}" data-testid="diff-tag">{r.tag}</div>
  {/each}
  <div class="note" data-testid="diff-note">{diffNote(match)}</div>
</div>

<style>
  .diff {
    --diff-border: #e3e6e8;
    --diff-bg: #fff;
    --diff-head-bg: #f8f9fa;
    --diff-head-text: #80838d;
    --diff-text: #1c2024;
    --diff-muted: #80838d;
    --diff-empty-bg: #f8f9fa;
    --diff-extra-bg: #fff4d5;
    --diff-extra-text: #ab6400;
    --diff-bad-bg: #feebec;
    --diff-bad-text: #ce2c31;

    display: grid;
    grid-template-columns: 1fr 1fr auto;
    border: 1px solid var(--diff-border);
    border-radius: 8px;
    background: var(--diff-bg);
    overflow: hidden;
    margin: 4px 0 6px;
  }
  .head {
    background: var(--diff-head-bg);
    color: var(--diff-head-text);
    font-family: Inter, system-ui, sans-serif;
    font-weight: 600;
    font-size: 11px;
    padding: 4px 10px;
  }
  .cell {
    font-family: var(--jide-code-font);
    font-size: 12.5px;
    line-height: 16px;
    padding: 3px 10px;
    color: var(--diff-text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .tag {
    font-family: Inter, system-ui, sans-serif;
    font-weight: 500;
    font-size: 11px;
    line-height: 16px;
    padding: 3px 10px;
    white-space: nowrap;
  }
  .extra.act {
    background: var(--diff-extra-bg);
  }
  .extra.exp,
  .missing.act {
    background: var(--diff-empty-bg);
  }
  .missing.exp,
  .different.exp,
  .different.act {
    background: var(--diff-bad-bg);
  }
  .tag.extra {
    color: var(--diff-extra-text);
  }
  .tag.missing,
  .tag.different {
    color: var(--diff-bad-text);
  }
  .ignored {
    color: var(--diff-muted);
  }
  .cell.ignored {
    color: var(--diff-muted);
  }
  .tag.ignored {
    color: var(--diff-muted);
  }
  .exp.different .mark {
    font-weight: 700;
    color: var(--diff-bad-text);
  }
  .ws {
    color: var(--diff-muted);
  }
  .note {
    grid-column: 1 / -1;
    background: var(--diff-head-bg);
    color: var(--diff-head-text);
    font-family: Inter, system-ui, sans-serif;
    font-size: 12px;
    padding: 6px 10px;
  }
</style>
