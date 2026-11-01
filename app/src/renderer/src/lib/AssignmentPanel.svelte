<script lang="ts">
  import { stripLeadingHeading } from "./exam-ui";
  import { renderMarkdown } from "./markdown";

  import { formatDate, isPast } from "../../../shared-types/datetime";

  let {
    markdown,
    deadline = null,
    submittedAt = null,
    late = false,
    heading,
    title = ""
  }: {
    markdown: string;
    deadline?: string | null;
    submittedAt?: string | null;
    late?: boolean;
    /** Exam mode: shown as the h1 instead of the leading `# Title` of the Markdown. */
    heading?: string;
    /** Exercise title: a leading `# <title>` is dropped when `heading` replaces it. */
    title?: string;
  } = $props();
  const html = $derived(renderMarkdown(heading ? stripLeadingHeading(markdown, title) : markdown));

  // Links in the assignment must never navigate the app window.
  function blockLinks(e: MouseEvent): void {
    if ((e.target as Element).closest("a")) e.preventDefault();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<aside class="assign" data-testid="assignment" onclick={blockLinks}>
  {#if deadline}
    <div class="deadline" data-testid="deadline">
      {#if submittedAt}<span class="chip" class:done={!late} class:late-hand={late}>{late ? "Abgegeben · verspätet" : "Abgegeben"}</span>{:else if isPast(deadline)}<span class="chip late"
          >Frist vorbei</span
        >{/if}Abgabe bis {formatDate(deadline)}
    </div>
  {/if}
  {#if heading}<h1 data-testid="assignment-heading">{heading}</h1>{/if}
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
  .assign :global(a) {
    color: #2f5bd3;
    cursor: default;
  }
</style>
