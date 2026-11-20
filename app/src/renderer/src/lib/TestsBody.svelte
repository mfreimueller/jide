<script lang="ts">
  import type { TestResult } from "../../../shared-types/api";
  import TestDiff from "./TestDiff.svelte";
  import { failSummary, firstDiffIndex, hasLineDiff, MSG_NOTE_CONTAINS } from "./diff-view";
  import { allPassed, countLabel, MSG_TESTS_FAILED, MSG_TESTS_OK } from "./test-state";

  /** The result list of the Tests panel; the same in the bottom panel and in the Tests window. */
  let {
    last,
    onopenat
  }: {
    last: { results: TestResult[]; summary: { passed: number; total: number } } | undefined;
    /** A row with a line number was clicked. */
    onopenat: (line: number) => void;
  } = $props();

  const ok = $derived(last ? allPassed(last.summary) : false);

  // T34: the first failed io test shows its line diff open; clicks override that per row, a new run resets it.
  const firstDiff = $derived(last ? firstDiffIndex(last.results) : -1);
  let diffOpen = $state<Record<number, boolean>>({});
  $effect(() => {
    last;
    diffOpen = {};
  });
</script>

<div class="tests" data-testid="tests">
  {#if last}
    <div class="banner" class:ok class:warn={!ok} data-testid="tests-banner">
      <span>{ok ? "✓" : "!"}</span>{ok ? MSG_TESTS_OK : MSG_TESTS_FAILED}
      <span class="spacer"></span>
      <span class="count">{countLabel(last.summary)}</span>
    </div>
    {#each last.results as r, i}
      {@const line = r.line}
      {#if hasLineDiff(r)}
        {@const open = diffOpen[i] ?? i === firstDiff}
        <div class="trow diffrow" data-testid="test-row" data-status={r.status}>
          <span class="fail">✗</span>
          <div class="tbody">
            <button
              class="thead"
              aria-expanded={open}
              data-testid="test-head"
              onclick={() => (diffOpen = { ...diffOpen, [i]: !open })}
            >
              <span class="chev">{open ? "⌄" : "›"}</span>
              <span class="tname">{r.name}</span>
              <span class="tsum">{failSummary(r.input)}</span>
            </button>
            {#if open}
              <TestDiff actual={r.actual ?? ""} expected={r.expected ?? ""} match={r.match} />
            {/if}
          </div>
        </div>
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
        <div
          class="trow"
          class:link={line !== undefined}
          data-testid="test-row"
          data-status={r.status}
          role={line !== undefined ? "button" : undefined}
          tabindex={line !== undefined ? 0 : undefined}
          onclick={() => line !== undefined && onopenat(line)}
          onkeydown={(e) => e.key === "Enter" && line !== undefined && onopenat(line)}
        >
          <span class={r.status === "passed" ? "pass" : "fail"}>{r.status === "passed" ? "✓" : "✗"}</span>
          <div class="tbody">
            <div class="tname">
              {r.name}
            </div>
            {#if r.status === "failed" && (r.expected !== undefined || r.actual !== undefined)}
              <div class="tdetail" data-testid="test-detail">
                <div><span class="lbl">erwartet:</span> <span class="val">{r.expected ?? ""}</span></div>
                <div><span class="lbl">dein Ergebnis:</span> <span class="val">{r.actual ?? ""}</span></div>
              </div>
              {#if r.match === "contains"}
                <div class="tnote" data-testid="test-note">{MSG_NOTE_CONTAINS}</div>
              {/if}
            {/if}
            {#if r.message}<div class="tdetail msgline" data-testid="test-message">{r.message}</div>{/if}
            {#if r.hint}<div class="tnote" data-testid="test-hint">{r.hint}</div>{/if}
          </div>
        </div>
      {/if}
    {/each}
  {:else}
    <p class="empty">Noch nicht getestet.</p>
  {/if}
</div>

<style>
  .tests {
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .banner {
    flex: none;
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    font-weight: 600;
  }
  .banner.warn {
    background: var(--bg-warn);
    color: var(--text-warn);
    border: 1px solid var(--border-warn);
  }
  .banner.ok {
    background: var(--bg-ok);
    color: var(--text-ok);
    border: 1px solid var(--border-ok);
  }
  .count {
    font-weight: 500;
    font-size: 13px;
  }
  .trow {
    font-size: 13px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 3px 4px;
  }
  .pass {
    color: var(--text-ok);
    font-weight: 700;
    width: 16px;
    flex: none;
  }
  .fail {
    color: var(--text-err);
    font-weight: 700;
    width: 16px;
    flex: none;
  }
  .tbody {
    min-width: 0;
    flex: 1;
  }
  .tdetail {
    font-family: var(--jide-code-font);
    font-size: 12px;
    color: var(--text-muted);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 5.5em;
    overflow-y: auto;
  }
  .tdetail .lbl {
    color: var(--text-faint);
  }
  .tnote {
    font-size: 12px;
    color: var(--text-faint);
    margin-top: 2px;
  }
  .thead {
    font: inherit;
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    color: inherit;
    cursor: pointer;
  }
  .chev {
    width: 10px;
    flex: none;
    color: var(--text-faint);
  }
  .tsum {
    font-family: var(--jide-code-font);
    font-size: 12px;
    color: var(--text-faint);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .msgline {
    font-family: inherit;
    font-size: 12.5px;
  }
  .trow.link {
    cursor: pointer;
    border-radius: 6px;
  }
  .trow.link:hover {
    background: var(--bg-subtle);
  }
  .empty {
    margin: 4px 10px;
    font-size: 13px;
    color: var(--text-faint);
  }
</style>
