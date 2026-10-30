<script lang="ts">
  import { renderMarkdown } from "./markdown";

  let { markdown }: { markdown: string } = $props();
  const html = $derived(renderMarkdown(markdown));

  // Links in the assignment must never navigate the app window.
  function blockLinks(e: MouseEvent): void {
    if ((e.target as Element).closest("a")) e.preventDefault();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<aside class="assign" data-testid="assignment" onclick={blockLinks}>
  {@html html}
</aside>

<style>
  .assign {
    width: 330px;
    flex: none;
    box-sizing: border-box;
    background: #fff;
    border-left: 1px solid #e3e6e8;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 14px;
    line-height: 21px;
    color: #3a3f45;
    overflow-y: auto;
  }
  .assign :global(h1) {
    font-size: 18px;
    line-height: 24px;
    font-weight: 600;
    color: #1c2024;
    margin: 0;
  }
  .assign :global(h2),
  .assign :global(h3),
  .assign :global(h4) {
    font-size: 14px;
    font-weight: 600;
    color: #1c2024;
    margin: 4px 0 0;
  }
  .assign :global(p) {
    margin: 0;
  }
  .assign :global(code) {
    font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
    font-size: 12.5px;
    background: #f1f3f5;
    padding: 1px 5px;
    border-radius: 4px;
    color: #1c2024;
  }
  .assign :global(pre) {
    margin: 0;
    font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
    font-size: 12.5px;
    background: #f1f3f5;
    padding: 10px 12px;
    border-radius: 8px;
    line-height: 19px;
    color: #1c2024;
    overflow-x: auto;
  }
  .assign :global(pre code) {
    background: none;
    padding: 0;
    font-size: inherit;
  }
  .assign :global(ul),
  .assign :global(ol) {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .assign :global(a) {
    color: #2f5bd3;
    cursor: default;
  }
</style>
