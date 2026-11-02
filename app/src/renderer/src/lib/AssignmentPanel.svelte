<script lang="ts">
  import { stripLeadingHeading } from "./exam-ui";
  import { renderMarkdown } from "./markdown";
  import PanelButton from "./PanelButton.svelte";
  import PanelStrip from "./PanelStrip.svelte";

  import { formatDate, isPast } from "../../../shared-types/datetime";

  let {
    markdown,
    deadline = null,
    submittedAt = null,
    late = false,
    heading,
    title = "",
    collapsed = false,
    width = 330,
    ontoggle
  }: {
    markdown: string;
    deadline?: string | null;
    submittedAt?: string | null;
    late?: boolean;
    /** Exam mode: shown as the h1 instead of the leading `# Title` of the Markdown. */
    heading?: string;
    /** Exercise title: a leading `# <title>` is dropped when `heading` replaces it. */
    title?: string;
    /** T29: collapsed to a strip / width of the open panel / expand-collapse (button and Alt+2). */
    collapsed?: boolean;
    width?: number;
    ontoggle: () => void;
  } = $props();
  const html = $derived(renderMarkdown(heading ? stripLeadingHeading(markdown, title) : markdown));

  // Links in the assignment must never navigate the app window.
  function blockLinks(e: MouseEvent): void {
    if ((e.target as Element).closest("a")) e.preventDefault();
  }
</script>

{#if collapsed}
  <PanelStrip side="right" label="Angabe" tip="Angabe aufklappen (Alt+2)" onclick={ontoggle} testid="assign" />
{/if}
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<aside class="assign" class:collapsed style:width="{width}px" data-testid="assignment" onclick={blockLinks}>
  <div class="head">
    <span class="pane-title">Angabe</span>
    <PanelButton icon="right" tip="Angabe einklappen (Alt+2)" place="below-right" onclick={ontoggle} testid="assign-collapse" />
  </div>
  <div class="body">
  {#if deadline}
    <div class="deadline" data-testid="deadline">
      {#if submittedAt}<span class="chip" class:done={!late} class:late-hand={late}>{late ? "Abgegeben · verspätet" : "Abgegeben"}</span>{:else if isPast(deadline)}<span class="chip late"
          >Frist vorbei</span
        >{/if}Abgabe bis {formatDate(deadline)}
    </div>
  {/if}
  {#if heading}<h1 data-testid="assignment-heading">{heading}</h1>{/if}
  {@html html}
  </div>
</aside>

<style>
  .assign {
    flex: none;
    box-sizing: border-box;
    background: #fff;
    border-left: 1px solid #e3e6e8;
    display: flex;
    flex-direction: column;
    font-size: 14px;
    line-height: 21px;
    color: #3a3f45;
  }
  /* collapsed: stays mounted (and in the DOM for the tests' sake) but takes no room */
  .assign.collapsed {
    display: none;
  }
  .head {
    flex: none;
    display: flex;
    align-items: center;
    padding: 14px 10px 4px 20px;
  }
  .head .pane-title {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    color: #80838d;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .body {
    flex: 1;
    min-height: 0;
    padding: 8px 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
  /* The body scrolls, so its children must keep their full height. Without this a
     long assignment squeezes code blocks (overflow-x: auto lets them shrink) to one line. */
  .body > :global(*) {
    flex-shrink: 0;
  }
  .deadline {
    font-size: 12px;
    display: flex;
    gap: 6px;
    align-items: center;
    color: #60646c;
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
    font-family: var(--jide-code-font);
    font-variant-ligatures: none;
    font-size: 12.5px;
    background: #f1f3f5;
    padding: 1px 5px;
    border-radius: 4px;
    color: #1c2024;
  }
  .assign :global(pre) {
    margin: 0;
    font-family: var(--jide-code-font);
    font-variant-ligatures: none;
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
  .assign :global(img) {
    max-width: 100%;
    height: auto;
  }
  .assign :global(a) {
    color: #2f5bd3;
    cursor: default;
  }
</style>
