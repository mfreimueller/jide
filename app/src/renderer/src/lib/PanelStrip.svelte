<script lang="ts">
  import PanelButton from "./PanelButton.svelte";

  /** Collapsed side panel: a 32px strip with the expand button and the vertical label (Figma 13). */
  let {
    side,
    label,
    tip,
    onclick,
    testid
  }: {
    /** Which side of the editor the strip is on: it sets the border and the icon. */
    side: "left" | "right";
    label: string;
    tip: string;
    onclick: () => void;
    testid: string;
  } = $props();
</script>

<div class="strip {side}" data-testid="{testid}-strip">
  <PanelButton icon={side === "left" ? "right" : "left"} {tip} place={side === "left" ? "below-left" : "below-right"} {onclick} testid="{testid}-expand" />
  <span class="label">{label}</span>
</div>

<style>
  .strip {
    width: 32px;
    flex: none;
    box-sizing: border-box;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
  }
  .strip.left {
    border-right: 1px solid #e3e6e8;
  }
  .strip.right {
    border-left: 1px solid #e3e6e8;
  }
  .label {
    writing-mode: vertical-rl;
    font-size: 11px;
    font-weight: 600;
    color: #80838d;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
</style>
