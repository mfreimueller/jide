<script lang="ts">
  import { stripLeadingHeading } from "./exam-ui";
  import { renderMarkdown } from "./markdown";
  import { BACK_LABEL, detachTip } from "../../../shared-types/panel-windows";
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
    ontoggle,
    onpick,
    ondetach,
    windowed = false,
    onback
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
    /** Scratch: opens the file dialog for an Angabe (.md). Present = empty state with "Angabe wählen …" / "Ändern …". */
    onpick?: () => void;
    /** M10: the ⧉ button; absent = no button (exam mode). */
    ondetach?: () => void;
    /** M10: shown in its own window: fills the window, no collapsing, "Zurück ins Hauptfenster" instead. */
    windowed?: boolean;
    onback?: () => void;
  } = $props();
  const empty = $derived(onpick !== undefined && markdown.trim() === "");
  const html = $derived(renderMarkdown(heading ? stripLeadingHeading(markdown, title) : markdown));

  // Links in the assignment must never navigate the app window.
  function blockLinks(e: MouseEvent): void {
    if ((e.target as Element).closest("a")) e.preventDefault();
  }
</script>

{#if collapsed && !windowed}
  <PanelStrip side="right" label="Angabe" tip="Angabe aufklappen (Alt+2)" onclick={ontoggle} testid="assign" />
{/if}
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<aside class="assign" class:collapsed={collapsed && !windowed} class:windowed style:width={windowed ? undefined : `${width}px`} data-testid="assignment" onclick={blockLinks}>
  <div class="head">
    <span class="pane-title">Angabe</span>
    {#if onpick && !empty}
      <button class="change" onclick={onpick} data-testid="assign-change">Ändern …</button>
    {/if}
    {#if windowed}
      <button class="btn back" onclick={onback} data-testid="panel-back">{BACK_LABEL}</button>
    {:else}
      {#if ondetach}
        <PanelButton icon="external" tip={detachTip("assign")} place="below-right" onclick={ondetach} testid="detach-assign" />
      {/if}
      <PanelButton icon="right" tip="Angabe einklappen (Alt+2)" place="below-right" onclick={ontoggle} testid="assign-collapse" />
    {/if}
  </div>
  <div class="body">
  {#if deadline}
    <div class="deadline" data-testid="deadline">
      {#if submittedAt}<span class="chip" class:done={!late} class:late-hand={late}>{late ? "Abgegeben · verspätet" : "Abgegeben"}</span>{:else if isPast(deadline)}<span class="chip late"
          >Frist vorbei</span
        >{/if}Abgabe bis {formatDate(deadline)}
    </div>
  {/if}
  {#if empty}
    <div class="empty" data-testid="assign-empty">
      <h1>Noch keine Angabe</h1>
      <p>Du kannst eine Markdown-Datei (.md) als Angabe dazugeben. Sie wird dann hier angezeigt.</p>
      <button class="btn" onclick={onpick} data-testid="assign-pick">Angabe wählen …</button>
    </div>
  {:else}
    {#if heading}<h1 data-testid="assignment-heading">{heading}</h1>{/if}
    {@html html}
  {/if}
  </div>
</aside>

<style>
  .assign {
    flex: none;
    box-sizing: border-box;
    background: var(--bg-panel);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    font-size: 14px;
    line-height: 21px;
    color: var(--text-2);
  }
  /* collapsed: stays mounted (and in the DOM for the tests' sake) but takes no room */
  .assign.collapsed {
    display: none;
  }
  .assign.windowed {
    flex: 1;
    min-height: 0;
    border-left: none;
  }
  .back {
    height: 26px;
    font-size: 12px;
    white-space: nowrap;
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
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .change {
    font: inherit;
    font-size: 12px;
    border: none;
    background: none;
    padding: 3px 6px;
    margin-right: 4px;
    border-radius: 4px;
    color: var(--text-link);
    cursor: pointer;
  }
  .change:hover {
    background: var(--bg-subtle);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .empty p {
    color: var(--text-muted);
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
    color: var(--text-muted);
  }
  .assign :global(h1) {
    font-size: 18px;
    line-height: 24px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .assign :global(h2),
  .assign :global(h3),
  .assign :global(h4) {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 4px 0 0;
  }
  .assign :global(p) {
    margin: 0;
  }
  .assign :global(code) {
    font-family: var(--jide-code-font);
    font-variant-ligatures: none;
    font-size: 12.5px;
    background: var(--bg-subtle);
    padding: 1px 5px;
    border-radius: 4px;
    color: var(--text);
  }
  .assign :global(pre) {
    margin: 0;
    font-family: var(--jide-code-font);
    font-variant-ligatures: none;
    font-size: 12.5px;
    background: var(--bg-subtle);
    padding: 10px 12px;
    border-radius: 8px;
    line-height: 19px;
    color: var(--text);
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
    background: #fff; /* drawn for white paper: transparent diagrams stay readable in dark mode */
  }
  .assign :global(a) {
    color: var(--text-link);
    cursor: default;
  }
</style>
