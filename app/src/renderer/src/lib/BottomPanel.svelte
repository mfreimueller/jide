<script lang="ts" module>
  export const BOTTOM_TABS = ["Konsole", "Probleme", "Tests"] as const;
  export type BottomTab = (typeof BOTTOM_TABS)[number];
</script>

<script lang="ts">
  import Console from "./Console.svelte";
  import { locationLabel } from "./diagnostics";
  import type { LiveCompiler } from "./problems.svelte";
  import type { RunController } from "./run.svelte";
  import type { EditorSession } from "./session.svelte";

  // Konsole (T6), Probleme (T5); Tests (M3) fills its tab later.
  let {
    tab = $bindable("Konsole"),
    problems,
    session,
    run
  }: { tab?: BottomTab; problems: LiveCompiler; session: EditorSession; run: RunController } = $props();

  const errors = $derived(problems.errorCount);
</script>

<div class="bottom">
  <div class="btabs">
    {#each BOTTOM_TABS as t}
      <button class="btab" class:active={tab === t} onclick={() => (tab = t)} data-testid="btab-{t}">
        {t}
        {#if t === "Probleme" && errors > 0}<span class="badge" data-testid="problems-badge">{errors}</span>{/if}
      </button>
    {/each}
    <span class="spacer"></span>
    {#if tab === "Konsole"}
      <button class="btn ghost clear" onclick={() => run.clear()} data-testid="clear-console">Leeren</button>
    {/if}
  </div>
  <div class="body" class:console={tab === "Konsole"} data-testid="bottom-{tab}">
    <!-- always mounted so the output survives tab switches -->
    {#if tab === "Konsole" && problems.systemError}
      <div class="system-error strip" role="alert" data-testid="system-error-console">{problems.systemError}</div>
    {/if}
    <div class="console-slot" class:hidden={tab !== "Konsole"}>
      <Console term={run.console} visible={tab === "Konsole"} />
    </div>
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
