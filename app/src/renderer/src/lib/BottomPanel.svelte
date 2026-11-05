<script lang="ts" module>
  export const BOTTOM_TABS = ["Konsole", "Probleme", "Tests"] as const;
  export type BottomTab = (typeof BOTTOM_TABS)[number];
</script>

<script lang="ts">
  import Console from "./Console.svelte";
  import PanelButton from "./PanelButton.svelte";
  import TestDiff from "./TestDiff.svelte";
  import { failSummary, firstDiffIndex, hasLineDiff, MSG_NOTE_CONTAINS } from "./diff-view";
  import { locationLabel } from "./diagnostics";
  import type { LiveCompiler } from "./problems.svelte";
  import type { RunController } from "./run.svelte";
  import type { EditorSession } from "./session.svelte";
  import type { TestController } from "./test.svelte";
  import { allPassed, countLabel, MSG_TESTS_FAILED, MSG_TESTS_OK } from "./test-state";
  import { formatTime } from "../../../shared-types/datetime";

  // Konsole (T6), Probleme (T5), Tests (T19, only for exercises with tests).
  let {
    tab = $bindable("Konsole"),
    problems,
    session,
    run,
    tests,
    collapsed = false,
    height = 230,
    ontoggle,
    onopen
  }: {
    tab?: BottomTab;
    problems: LiveCompiler;
    session: EditorSession;
    run: RunController;
    tests?: TestController;
    /** T29: only the tab bar stays / height of the open panel / button and Alt+3 / a tab was clicked. */
    collapsed?: boolean;
    height?: number;
    ontoggle: () => void;
    onopen: () => void;
  } = $props();

  const errors = $derived(problems.errorCount);
  const tabs = $derived(BOTTOM_TABS.filter((t) => t !== "Tests" || tests));
  const last = $derived(tests?.last);
  const ok = $derived(last ? allPassed(last.summary) : false);
  const failedCount = $derived(last ? last.summary.total - last.summary.passed : 0);

  // T34: the first failed io test shows its line diff open; clicks override that per row, a new run resets it.
  const firstDiff = $derived(last ? firstDiffIndex(last.results) : -1);
  let diffOpen = $state<Record<number, boolean>>({});
  $effect(() => {
    last;
    diffOpen = {};
  });
</script>

<div class="bottom" class:collapsed style:height={collapsed ? undefined : `${height}px`}>
  <div class="btabs">
    {#each tabs as t}
      <button class="btab" class:active={tab === t} onclick={() => { tab = t; onopen(); }} data-testid="btab-{t}">
        {t}
        {#if t === "Probleme" && errors > 0}<span class="badge" data-testid="problems-badge">{errors}</span>{/if}
        {#if t === "Tests" && last}
          <span class="badge" class:ok data-testid="tests-badge">{ok ? `${last.summary.passed}/${last.summary.total}` : failedCount}</span>
        {/if}
      </button>
    {/each}
    <span class="spacer"></span>
    {#if tab === "Tests" && last}
      <span class="small" data-testid="tests-time">zuletzt getestet {formatTime(last.at)}</span>
    {/if}
    {#if tab === "Konsole" && !collapsed}
      <button class="btn ghost clear" onclick={() => run.clear()} data-testid="clear-console">Leeren</button>
    {/if}
    <PanelButton
      icon={collapsed ? "up" : "down"}
      tip={collapsed ? "Ausgabe aufklappen (Alt+3)" : "Ausgabe einklappen (Alt+3)"}
      place="above-right"
      onclick={ontoggle}
      testid="bottom-toggle"
    />
  </div>
  <div class="body" class:hidden={collapsed} class:console={tab === "Konsole"} data-testid="bottom-{tab}">
    <!-- always mounted so the output survives tab switches -->
    {#if tab === "Konsole" && problems.systemError}
      <div class="system-error strip" role="alert" data-testid="system-error-console">{problems.systemError}</div>
    {/if}
    <div class="console-slot" class:hidden={tab !== "Konsole"}>
      <Console term={run.console} visible={tab === "Konsole" && !collapsed} />
    </div>
    {#if tab === "Tests" && tests}
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
              onclick={() => line !== undefined && session.openAt(tests.mainFile, line)}
              onkeydown={(e) => e.key === "Enter" && line !== undefined && session.openAt(tests.mainFile, line)}
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
              </div>
            </div>
            {/if}
          {/each}
        {:else}
          <p class="empty">Noch nicht getestet.</p>
        {/if}
      </div>
    {/if}
    {#if tab === "Probleme"}
      <div class="problems" data-testid="problems">
        {#if problems.systemError}
          <div class="system-error" role="alert" data-testid="system-error">{problems.systemError}</div>
        {/if}
        {#each problems.diagnostics as d}
          <button
            class="prob"
            data-testid="problem"
            disabled={d.file === null || d.line === null}
            onclick={() => d.file !== null && d.line !== null && session.openAt(d.file, d.line, d.column ?? 1)}
          >
            <span class="icon {d.severity}">{d.severity === "error" ? "●" : "▲"}</span>
            <span class="msg">{d.message}</span>
            <span class="loc">{locationLabel(d)}</span>
          </button>
        {:else}
          {#if !problems.systemError}<p class="empty">Keine Probleme gefunden.</p>{/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .bottom {
    flex: none;
    border-top: 1px solid #e3e6e8;
    background: #fff;
    display: flex;
    flex-direction: column;
  }
  .bottom.collapsed .btabs {
    border-bottom: none;
  }
  .body.hidden {
    display: none;
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
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .btab.active {
    background: #f1f3f5;
    color: #1c2024;
    font-weight: 500;
  }
  .clear {
    height: 26px;
    font-size: 12px;
  }
  .badge {
    font-size: 11px;
    background: #e5484d;
    color: #fff;
    border-radius: 999px;
    padding: 0 6px;
    font-weight: 600;
  }
  .badge.ok {
    background: #30a46c;
  }
  .small {
    font-size: 12px;
    color: #80838d;
  }
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
    background: #fff4d5;
    color: #ab6400;
    border: 1px solid #ffdc8f;
  }
  .banner.ok {
    background: #e6f6ec;
    color: #18794e;
    border: 1px solid #b4e2c4;
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
    color: #18794e;
    font-weight: 700;
    width: 16px;
    flex: none;
  }
  .fail {
    color: #ce2c31;
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
    color: #60646c;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 5.5em;
    overflow-y: auto;
  }
  .tdetail .lbl {
    color: #80838d;
  }
  .tnote {
    font-size: 12px;
    color: #80838d;
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
    color: #80838d;
  }
  .tsum {
    font-family: var(--jide-code-font);
    font-size: 12px;
    color: #80838d;
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
    background: #f1f3f5;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .console-slot {
    flex: 1;
    min-height: 0;
  }
  .console-slot.hidden {
    display: none;
  }
  .system-error.strip {
    border-radius: 0;
    flex: none;
  }
  .body.console {
    background: #1c2024;
  }
  .problems {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .prob {
    font: inherit;
    font-size: 13px;
    text-align: left;
    border: none;
    background: none;
    color: #1c2024;
    padding: 6px 10px;
    border-radius: 6px;
    display: flex;
    gap: 10px;
    align-items: center;
    cursor: pointer;
  }
  .prob:hover:not(:disabled) {
    background: #f1f3f5;
  }
  .prob:disabled {
    cursor: default;
  }
  .icon.error {
    color: #e5484d;
  }
  .icon.warning {
    color: #ab6400;
  }
  .msg {
    flex: 1;
  }
  .loc {
    color: #80838d;
    font-size: 12px;
  }
  .empty {
    margin: 4px 10px;
    font-size: 13px;
    color: #80838d;
  }
  .system-error {
    background: #feebec;
    color: #ce2c31;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
  }
</style>
