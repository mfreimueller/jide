<script lang="ts">
  import type { Snippet } from "svelte";
  import iconUrl from "../assets/icon.svg";

  /**
   * The centred white card of the exam screens (Figma 07 start, 09 exam.json broken, 10 no JDK):
   * logo, heading with intro text, the screen's own content, small footer. Same look as the login.
   */
  let {
    heading,
    intro,
    footer,
    testid,
    children
  }: { heading: string; intro: Snippet; footer: string; testid: string; children: Snippet } = $props();
</script>

<div class="center">
  <div class="card" data-testid={testid}>
    <div class="logo"><img class="logo-mark" src={iconUrl} alt="" />J;DE</div>
    <div class="intro">
      <h1>{heading}</h1>
      <p class="muted">{@render intro()}</p>
    </div>
    {@render children()}
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
</style>
