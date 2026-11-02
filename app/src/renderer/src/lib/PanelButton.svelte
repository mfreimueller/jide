<script lang="ts">
  /** Small icon button of the panel headers and strips, with the dark tooltip of Figma 12/13. */
  let {
    icon,
    tip,
    place = "below-left",
    onclick,
    testid
  }: {
    icon: "left" | "right" | "down" | "up";
    tip: string;
    place?: "below-left" | "below-right" | "above-right";
    onclick: () => void;
    testid: string;
  } = $props();
</script>

<button class="pbtn" aria-label={tip} data-tip={tip} data-place={place} {onclick} data-testid={testid}>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if icon === "left"}<path d="M8 4 4 8l4 4M12 4 8 8l4 4" />
    {:else if icon === "right"}<path d="m8 4 4 4-4 4M4 4l4 4-4 4" />
    {:else if icon === "down"}<path d="m4 6 4 4 4-4" />
    {:else}<path d="m4 10 4-4 4 4" />{/if}
  </svg>
</button>

<style>
  .pbtn {
    position: relative;
    flex: none;
    display: inline-flex;
    padding: 3px;
    border: none;
    border-radius: 4px;
    background: none;
    color: #80838d;
    cursor: pointer;
  }
  .pbtn:hover {
    background: #f1f3f5;
  }
  .pbtn::after {
    content: attr(data-tip);
    position: absolute;
    display: none;
    z-index: 30;
    white-space: nowrap;
    background: #1c2024;
    color: #fff;
    font-size: 12px;
    line-height: 16px;
    padding: 4px 8px;
    border-radius: 6px;
    pointer-events: none;
  }
  .pbtn:hover::after {
    display: block;
  }
  .pbtn[data-place="below-left"]::after {
    top: calc(100% + 4px);
    left: 0;
  }
  .pbtn[data-place="below-right"]::after {
    top: calc(100% + 4px);
    right: 0;
  }
  .pbtn[data-place="above-right"]::after {
    bottom: calc(100% + 4px);
    right: 0;
  }
</style>
