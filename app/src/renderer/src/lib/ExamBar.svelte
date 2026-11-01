<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The dark bar of every exam screen (Figma 07-11). `children` is shown between the title and the
   * right-hand info (T24/T25: student name, save status).
   */
  let { title, info, children }: { title: string; info: string; children?: Snippet } = $props();
</script>

<div class="exam-bar" data-testid="exam-bar">
  <span class="badge">PRÜFUNG</span>
  <span class="exam-title" data-testid="exam-title">{title}</span>
  {@render children?.()}
  <span class="spacer"></span>
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
    background: #1c2024;
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
  .exam-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
