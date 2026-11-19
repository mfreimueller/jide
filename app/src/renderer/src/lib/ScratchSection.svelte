<!-- The "Scratch" section of the exercise list: own programs without a server (Figma: Schüler-App 20-24). -->
<script lang="ts">
  import type { ExerciseSummary } from "../../../shared-types/api";
  import { scratchLine } from "./scratch-ui";
  import TextDialog from "./TextDialog.svelte";

  let {
    items,
    hint,
    onOpen,
    onChanged
  }: {
    items: ExerciseSummary[];
    hint: string;
    onOpen: (id: string) => void;
    /** Called after create / rename / delete so the parent reloads the Scratch items. */
    onChanged: () => Promise<void>;
  } = $props();

  type Dialog =
    | { kind: "create" }
    | { kind: "rename"; item: ExerciseSummary }
    | { kind: "delete"; item: ExerciseSummary };
  let dialog = $state.raw<Dialog | undefined>();
  let menuFor = $state<string | undefined>();

  async function create(name: string): Promise<string | undefined> {
    const r = await window.jide.scratchCreate(name);
    if (!r.ok) return r.message;
    dialog = undefined;
    await onChanged();
    onOpen(r.id);
    return undefined;
  }

  async function rename(item: ExerciseSummary, name: string): Promise<string | undefined> {
    const r = await window.jide.scratchRename(item.id, name);
    if (!r.ok) return r.message;
    dialog = undefined;
    await onChanged();
    return undefined;
  }

  async function remove(item: ExerciseSummary): Promise<string | undefined> {
    const r = await window.jide.scratchDelete(item.id);
    if (!r.ok) return r.message;
    dialog = undefined;
    await onChanged();
    return undefined;
  }

  function show(d: Dialog): void {
    menuFor = undefined;
    dialog = d;
  }
</script>

<svelte:window
  onclick={() => (menuFor = undefined)}
  onkeydown={(e) => e.key === "Escape" && menuFor !== undefined && (menuFor = undefined)}
/>

<div class="section-head" data-testid="scratch-heading">
  <span class="section-title">Scratch</span>
  <span class="hint">{hint}</span>
  <span class="spacer"></span>
  <button class="btn small" onclick={() => (dialog = { kind: "create" })} data-testid="scratch-new">
    <span class="link">+ Neues Programm</span>
  </button>
</div>

{#each items as item (item.id)}
  <div class="ex" data-testid="scratch-item" data-id={item.id}>
    <div class="icon" aria-hidden="true">{"{ }"}</div>
    <div class="ex-main">
      <span class="ex-title">{item.title}</span>
      <span class="muted">{scratchLine(item.classCount ?? 1)}</span>
    </div>
    <div class="menu-wrap">
      <button
        class="btn icon-btn"
        aria-label="Mehr"
        aria-haspopup="menu"
        aria-expanded={menuFor === item.id}
        onclick={(e) => {
          e.stopPropagation();
          menuFor = menuFor === item.id ? undefined : item.id;
        }}
        data-testid="scratch-menu"
      >⋯</button>
      {#if menuFor === item.id}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
        <div class="menu" role="menu" onclick={(e) => e.stopPropagation()}>
          <button class="menu-item" role="menuitem" onclick={() => show({ kind: "rename", item })} data-testid="scratch-rename">Umbenennen …</button>
          <button class="menu-item danger" role="menuitem" onclick={() => show({ kind: "delete", item })} data-testid="scratch-delete">Löschen …</button>
        </div>
      {/if}
    </div>
    <button class="btn primary" onclick={() => onOpen(item.id)} data-testid="scratch-open">Öffnen</button>
  </div>
{/each}
{#if items.length === 0}
  <p class="muted empty" data-testid="scratch-empty">Noch keine eigenen Programme.</p>
{/if}

{#if dialog?.kind === "create"}
  <TextDialog
    heading="Neues Programm"
    text="Gib deinem Programm einen Namen. Es startet mit der Datei Main.java – weitere Klassen kannst du später dazugeben."
    label="Name"
    confirmLabel="Erstellen"
    onCancel={() => (dialog = undefined)}
    onSubmit={create}
    testid="scratch-dialog"
  />
{:else if dialog?.kind === "rename"}
  {@const item = dialog.item}
  <TextDialog
    heading="Umbenennen"
    badge="✎"
    label="Name"
    value={item.title}
    confirmLabel="Speichern"
    onCancel={() => (dialog = undefined)}
    onSubmit={(name) => rename(item, name)}
    testid="scratch-dialog"
  />
{:else if dialog?.kind === "delete"}
  {@const item = dialog.item}
  <TextDialog
    heading={`„${item.title}“ löschen?`}
    text="Das Programm und alle seine Dateien werden von diesem Laptop gelöscht."
    badge="!"
    tone="danger"
    confirmLabel="Löschen"
    onCancel={() => (dialog = undefined)}
    onSubmit={() => remove(item)}
    testid="scratch-dialog"
  />
{/if}

<style>
  .section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .hint {
    font-size: 13px;
    color: var(--text-faint);
  }
  .btn.small {
    height: 30px;
    padding: 0 12px;
    font-size: 13px;
  }
  .link {
    color: var(--text-link);
  }
  .ex {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .icon {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-subtle);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--jide-code-font);
    font-size: 13px;
    font-weight: 600;
  }
  .ex-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ex-title {
    font-size: 16px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    color: var(--text-muted);
    font-size: 14px;
    line-height: 20px;
    margin: 0;
  }
  .empty {
    margin: 0;
  }
  .menu-wrap {
    position: relative;
  }
  .icon-btn {
    width: 34px;
    padding: 0;
    justify-content: center;
    font-size: 18px;
    line-height: 1;
    color: var(--text-muted);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 20;
    min-width: 160px;
    background: var(--bg-panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
  }
  .menu-item {
    font: inherit;
    font-size: 14px;
    text-align: left;
    border: none;
    background: none;
    padding: 8px 12px;
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
  }
  .menu-item:hover {
    background: var(--bg-subtle);
  }
  .menu-item.danger {
    color: var(--text-err);
  }
</style>
