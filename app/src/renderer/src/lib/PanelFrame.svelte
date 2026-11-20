<script lang="ts">
  import type { Snippet } from "svelte";
  import { BACK_LABEL, type DetachablePanel } from "../../../shared-types/panel-windows";

  /** The frame of the Konsole / Probleme / Tests window: a tab-like title, extras, "Zurück ins Hauptfenster", the body. */
  let {
    panel,
    title,
    badge,
    badgeOk = false,
    extras,
    dark = false,
    children
  }: {
    panel: DetachablePanel;
    title: string;
    badge?: string;
    badgeOk?: boolean;
    extras?: Snippet;
    /** The body is dark (console). */
    dark?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="frame">
  <div class="btabs">
    <span class="btab" data-testid="window-title">
      {title}
      {#if badge}<span class="badge" class:ok={badgeOk} data-testid="window-badge">{badge}</span>{/if}
    </span>
    <span class="spacer"></span>
    {#if extras}{@render extras()}{/if}
    <button class="btn back" onclick={() => window.jide.panels.dock(panel)} data-testid="panel-back">{BACK_LABEL}</button>
  </div>
  <div class="body" class:dark>
    {@render children()}
  </div>
</div>

<style>
  .frame {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-panel);
  }
  .btabs {
    height: 36px;
    flex: none;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 8px;
  }
  .btab {
    font-size: 13px;
    padding: 6px 12px;
    border-radius: 6px;
    background: var(--bg-subtle);
    color: var(--text);
    font-weight: 500;
    display: flex;
    gap: 6px;
    align-items: center;
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
  .back {
    height: 26px;
    font-size: 12px;
    white-space: nowrap;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .body.dark {
    background: var(--bg-dark);
    overflow: hidden;
  }
</style>
