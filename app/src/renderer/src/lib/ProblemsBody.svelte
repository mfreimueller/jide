<script lang="ts">
  import type { Diagnostic } from "../../../shared-types/api";
  import { locationLabel } from "./diagnostics";

  /** The problem list of the Probleme panel; the same in the bottom panel and in the Probleme window. */
  let {
    diagnostics,
    systemError,
    onopenat
  }: {
    diagnostics: Diagnostic[];
    systemError: string;
    onopenat: (file: string, line: number, column: number) => void;
  } = $props();
</script>

<div class="problems" data-testid="problems">
  {#if systemError}
    <div class="system-error" role="alert" data-testid="system-error">{systemError}</div>
  {/if}
  {#each diagnostics as d}
    <button
      class="prob"
      data-testid="problem"
      disabled={d.file === null || d.line === null}
      onclick={() => d.file !== null && d.line !== null && onopenat(d.file, d.line, d.column ?? 1)}
    >
      <span class="icon {d.severity}">{d.severity === "error" ? "●" : "▲"}</span>
      <span class="msg">{d.message}</span>
      <span class="loc">{locationLabel(d)}</span>
    </button>
  {:else}
    {#if !systemError}<p class="empty">Keine Probleme gefunden.</p>{/if}
  {/each}
</div>

<style>
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
    color: var(--text);
    padding: 6px 10px;
    border-radius: 6px;
    display: flex;
    gap: 10px;
    align-items: center;
    cursor: pointer;
  }
  .prob:hover:not(:disabled) {
    background: var(--bg-subtle);
  }
  .prob:disabled {
    cursor: default;
  }
  .icon.error {
    color: #e5484d;
  }
  .icon.warning {
    color: var(--text-warn);
  }
  .msg {
    flex: 1;
  }
  .loc {
    color: var(--text-faint);
    font-size: 12px;
  }
  .empty {
    margin: 4px 10px;
    font-size: 13px;
    color: var(--text-faint);
  }
  .system-error {
    background: var(--bg-err);
    color: var(--text-err);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
  }
</style>
