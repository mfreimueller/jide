<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The dark bar of every exam screen (Figma 07-11). `children` is shown between the title and the
   * right-hand info (T24/T25: student name, save status).
   */
  let {
    title,
    info,
    status,
    children
  }: {
    title: string;
    info: string;
    /** Save status (exam workspace): green after a save, amber when the hand-in drive is not reachable. */
    status?: { tone: "ok" | "warn"; text: string };
    children?: Snippet;
  } = $props();
</script>

<div class="exam-bar" data-testid="exam-bar">
  <span class="badge">PRÜFUNG</span>
  <span class="exam-title" data-testid="exam-title">{title}</span>
  {@render children?.()}
  <span class="spacer"></span>
  {#if status}
    <span class="save-status" class:warn={status.tone === "warn"} data-testid="exam-save-status" data-tone={status.tone}>{status.text}</span>
  {/if}
  <span class="info" data-testid="exam-info">{info}</span>
</div>

<style>
  .exam-bar {
    height: 30px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    background: var(--bg-dark);
    color: #fff;
    font-size: 12px;
  }
  .badge {
    background: #ed1944;
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    border-radius: 4px;
    padding: 2px 8px;
  }
  .save-status {
    color: #7ce2a6;
    white-space: nowrap;
  }
  .save-status.warn {
    color: #ffb533;
  }
  .exam-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
