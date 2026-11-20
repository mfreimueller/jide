<script lang="ts">
  import type { Diagnostic } from "../../../shared-types/api";
  import { BOTTOM_TABS, detachTip, panelOfTab, type BottomTab } from "../../../shared-types/panel-windows";
  import Console from "./Console.svelte";
  import PanelButton from "./PanelButton.svelte";
  import ProblemsBody from "./ProblemsBody.svelte";
  import TestsBody from "./TestsBody.svelte";
  import type { LiveCompiler } from "./problems.svelte";
  import type { RunController } from "./run.svelte";
  import type { EditorSession } from "./session.svelte";
  import type { TestController } from "./test.svelte";
  import { allPassed } from "./test-state";
  import { formatTime } from "../../../shared-types/datetime";

  // Konsole (T6), Probleme (T5), Tests (T19, only for exercises with tests).
  let {
    tab = $bindable("Konsole"),
    visibleTabs = [...BOTTOM_TABS],
    problems,
    session,
    run,
    tests,
    collapsed = false,
    fill = false,
    height = 230,
    ontoggle,
    onopen,
    ondetach
  }: {
    /** The tab the student chose; if it is in its own window, the first visible one is shown. */
    tab?: BottomTab;
    /** M10: the tabs that are not in their own window; none = the whole panel is hidden. */
    visibleTabs?: BottomTab[];
    problems: LiveCompiler;
    session: EditorSession;
    run: RunController;
    tests?: TestController;
    /** T29: only the tab bar stays / height of the open panel / button and Alt+3 / a tab was clicked. */
    collapsed?: boolean;
    /** M10: the Code panel is in its own window, the bottom panel fills the middle. */
    fill?: boolean;
    height?: number;
    ontoggle: () => void;
    onopen: () => void;
    /** M10: the ⧉ button; absent = no button (exam mode). */
    ondetach?: (tab: BottomTab) => void;
  } = $props();

  const errors = $derived(problems.errorCount);
  const tabs = $derived(visibleTabs.filter((t) => t !== "Tests" || tests));
  const current = $derived<BottomTab>(tabs.includes(tab) ? tab : (tabs[0] ?? tab));
  const last = $derived(tests?.last);
  const ok = $derived(last ? allPassed(last.summary) : false);
  const failedCount = $derived(last ? last.summary.total - last.summary.passed : 0);
</script>

<div class="bottom" class:collapsed class:fill class:gone={tabs.length === 0} style:height={collapsed || fill ? undefined : `${height}px`}>
  <div class="btabs">
    {#each tabs as t}
      <button class="btab" class:active={current === t} onclick={() => { tab = t; onopen(); }} data-testid="btab-{t}">
        {t}
        {#if t === "Probleme" && errors > 0}<span class="badge" data-testid="problems-badge">{errors}</span>{/if}
        {#if t === "Tests" && last}
          <span class="badge" class:ok data-testid="tests-badge">{ok ? `${last.summary.passed}/${last.summary.total}` : failedCount}</span>
        {/if}
      </button>
    {/each}
    <span class="spacer"></span>
    {#if current === "Tests" && last && tests?.stale}
      <span class="chip late-hand" data-testid="tests-stale">Code geändert – bitte neu testen</span>
    {/if}
    {#if current === "Tests" && last}
      <span class="small" data-testid="tests-time">zuletzt getestet {formatTime(last.at)}</span>
    {/if}
    {#if current === "Konsole" && !collapsed}
      <button class="btn ghost clear" onclick={() => run.clear()} data-testid="clear-console">Leeren</button>
    {/if}
    {#if ondetach}
      <PanelButton icon="external" tip={detachTip(panelOfTab(current))} place="above-right" onclick={() => ondetach(current)} testid="detach-bottom" />
    {/if}
    <PanelButton
      icon={collapsed ? "up" : "down"}
      tip={collapsed ? "Ausgabe aufklappen (Alt+3)" : "Ausgabe einklappen (Alt+3)"}
      place="above-right"
      onclick={ontoggle}
      testid="bottom-toggle"
    />
  </div>
  <div class="body" class:hidden={collapsed} class:console={current === "Konsole"} data-testid="bottom-{current}">
    <!-- always mounted so the output survives tab switches (and a Konsole in its own window) -->
    {#if current === "Konsole" && problems.systemError}
      <div class="system-error strip" role="alert" data-testid="system-error-console">{problems.systemError}</div>
    {/if}
    <div class="console-slot" class:hidden={current !== "Konsole"}>
      <Console term={run.console} visible={current === "Konsole" && !collapsed && tabs.length > 0} />
    </div>
    {#if current === "Tests" && tests}
      <TestsBody {last} onopenat={(line) => session.openAt(tests.mainFile, line)} />
    {/if}
    {#if current === "Probleme"}
      <ProblemsBody
        diagnostics={problems.diagnostics as Diagnostic[]}
        systemError={problems.systemError}
        onopenat={(file, line, column) => session.openAt(file, line, column)}
      />
    {/if}
  </div>
</div>

<style>
  .bottom {
    flex: none;
    border-top: 1px solid var(--border);
    background: var(--bg-panel);
    display: flex;
    flex-direction: column;
  }
  /* Code is in its own window: the bottom panel takes the whole middle. */
  .bottom.fill:not(.collapsed) {
    flex: 1;
    min-height: 0;
  }
  .bottom.gone {
    display: none;
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
    border-bottom: 1px solid var(--border);
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
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .btab.active {
    background: var(--bg-subtle);
    color: var(--text);
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
    color: var(--text-faint);
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
    background: var(--bg-dark);
  }
  .system-error {
    background: var(--bg-err);
    color: var(--text-err);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
  }
</style>
