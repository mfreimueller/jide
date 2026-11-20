<!-- The "Scratch" section of the exercise list: own programs without a server (Figma: Schüler-App 20-24). -->
<script lang="ts">
  import type { ExerciseSummary } from "../../../shared-types/api";
  import DifficultyPill from "./DifficultyPill.svelte";
  import { importedLine, scratchLine } from "./scratch-ui";
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
  let importMenu = $state(false);
  let importError = $state("");
  let importing = $state(false);

  async function importExercise(kind: "folder" | "zip"): Promise<void> {
    importMenu = false;
    importError = "";
    importing = true;
    try {
      const r = await window.jide.scratchImport(kind);
      if (!r.ok) importError = r.message;
      else if (!r.canceled) await onChanged();
    } catch {
      importError = "Das hat leider nicht geklappt.";
    } finally {
      importing = false;
    }
  }

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
  onclick={() => {
    menuFor = undefined;
    importMenu = false;
  }}
  onkeydown={(e) => {
    if (e.key !== "Escape") return;
    menuFor = undefined;
    importMenu = false;
  }}
/>

<div class="section-head" data-testid="scratch-heading">
  <span class="scratch-title">Scratch</span>
  <span class="hint">{hint}</span>
  <span class="spacer"></span>
  <div class="menu-wrap">
    <button
      class="btn small"
      aria-haspopup="menu"
      aria-expanded={importMenu}
      disabled={importing}
      onclick={(e) => {
        e.stopPropagation();
        importMenu = !importMenu;
      }}
      data-testid="scratch-import"
    >
      <span class="link">Aufgabe importieren …</span>
    </button>
    {#if importMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
      <div class="menu" role="menu" onclick={(e) => e.stopPropagation()}>
        <button class="menu-item" role="menuitem" onclick={() => importExercise("folder")} data-testid="scratch-import-folder">Ordner wählen …</button>
        <button class="menu-item" role="menuitem" onclick={() => importExercise("zip")} data-testid="scratch-import-zip">ZIP-Datei wählen …</button>
      </div>
    {/if}
  </div>
  <button class="btn small" onclick={() => (dialog = { kind: "create" })} data-testid="scratch-new">
    <span class="link">+ Neues Programm</span>
  </button>
</div>
{#if importError}
  <div class="import-error" role="alert" data-testid="scratch-import-error">
    <span>{importError}</span>
    <button class="btn small" onclick={() => (importError = "")} data-testid="scratch-import-error-close">Schließen</button>
  </div>
{/if}

{#each items as item (item.id)}
  <div class="ex" data-testid="scratch-item" data-id={item.id}>
    <div class="icon" aria-hidden="true">{"{ }"}</div>
    <div class="ex-main">
      <div class="ex-head">
        <span class="ex-title">{item.title}</span>
        {#if item.difficulty}<DifficultyPill level={item.difficulty} />{/if}
      </div>
      <span class="muted" data-testid="scratch-line">{item.imported ? importedLine(item.testCount ?? 0, item.copied === true) : scratchLine(item.classCount ?? 1)}</span>
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
  .scratch-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ex-head {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .import-error {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--bg-warn);
    border: 1px solid var(--border-warn);
    color: var(--text-warn);
    font-size: 13px;
    line-height: 19px;
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
