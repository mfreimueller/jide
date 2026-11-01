<script lang="ts">
  import { onMount } from "svelte";
  import ExamCard from "./ExamCard.svelte";

  /** Exam error screens (Figma 09: exam.json broken, 10: no JDK 25). Same card as the login. */
  let {
    heading,
    text,
    label,
    lines,
    tone,
    footer
  }: { heading: string; text: string; label: string; lines: string[]; tone: "error" | "neutral"; footer: string } = $props();

  onMount(() => {
    // Tell main that a screen has rendered (smoke test).
    requestAnimationFrame(() => window.jide.notifyEditorReady());
  });
</script>

<ExamCard heading={heading} {footer} testid="exam-problem">
  {#snippet intro()}{text}{/snippet}
  <div class="details" class:error={tone === "error"} data-testid="exam-details">
    <span class="label">{label}</span>
    <div class="mono">
      {#each lines as line, i (i)}<div class="line">{line}</div>{/each}
    </div>
  </div>
  <button class="btn big" type="button" onclick={() => window.jide.quit()}>J;DE beenden</button>
</ExamCard>

<style>
  .details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #f3f4f6;
    border: 1px solid #dee2e6;
  }
  .details.error {
    background: #fdecee;
    border-color: #f8c4cc;
  }
  .label {
    font-size: 12px;
    font-weight: 500;
    color: #3a3f45;
  }
  .mono {
    font-family: var(--jide-code-font);
    font-size: 12px;
    line-height: 18px;
    color: #1c2024;
    overflow-wrap: anywhere;
  }
  .line {
    white-space: pre-wrap;
  }
  .btn.big {
    height: 44px;
    font-size: 16px;
    padding: 0 22px;
    justify-content: center;
    border-color: #d1d5db;
  }
</style>
