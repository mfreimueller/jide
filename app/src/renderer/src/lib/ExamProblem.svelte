<script lang="ts">
  import { onMount } from "svelte";
  import iconUrl from "../assets/icon.svg";

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

<div class="center">
  <div class="card" data-testid="exam-problem">
    <div class="logo"><img class="logo-mark" src={iconUrl} alt="" />J;DE</div>
    <div class="intro">
      <h1>{heading}</h1>
      <p class="muted">{text}</p>
    </div>
    <div class="details" class:error={tone === "error"} data-testid="exam-details">
      <span class="label">{label}</span>
      <div class="mono">
        {#each lines as line, i (i)}<div class="line">{line}</div>{/each}
      </div>
    </div>
    <button class="btn big" type="button" onclick={() => window.jide.quit()}>J;DE beenden</button>
    <p class="small">{footer}</p>
  </div>
</div>

<style>
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
  }
  .card {
    background: #fff;
    border: 1px solid #e3e6e8;
    border-radius: 14px;
    padding: 40px;
    width: 440px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 26px;
    font-weight: 700;
  }
  .logo-mark {
    width: 40px;
    height: 40px;
    display: block;
  }
  .intro {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
  }
  .muted {
    margin: 0;
    color: #60646c;
    font-size: 14px;
    line-height: 20px;
  }
  .small {
    margin: 0;
    font-size: 12px;
    color: #80838d;
  }
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
