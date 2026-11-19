<!-- "Fehlerbericht" dialog (T44, Figma Schüler-App 26/27): the report to copy or save for the teacher. -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import BugIcon from "./BugIcon.svelte";

  let {
    report,
    fileName,
    onClose
  }: {
    report: string;
    /** Default name in the save dialog. */
    fileName: string;
    onClose: () => void;
  } = $props();

  let note = $state<{ text: string; err: boolean } | undefined>();
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  async function copy(): Promise<void> {
    try {
      await window.jide.reportCopy(report);
      copied = true;
      note = undefined;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 2000);
    } catch {
      note = { text: "Das Kopieren hat nicht geklappt.", err: true };
    }
  }

  async function save(): Promise<void> {
    try {
      const r = await window.jide.reportSave(fileName, report);
      if (r.ok) note = { text: "Gespeichert", err: false };
      else if (!r.canceled) note = { text: "Das Speichern hat nicht geklappt.", err: true };
    } catch {
      note = { text: "Das Speichern hat nicht geklappt.", err: true };
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<div class="overlay" data-testid="bug-report-dialog">
  <div class="dialog" role="dialog" aria-labelledby="bug-title" aria-describedby="bug-text">
    <div class="dialog-icon"><BugIcon size={22} /></div>
    <h1 id="bug-title">Fehlerbericht</h1>
    <p class="muted" id="bug-text">Kopiere den Bericht und schick ihn deiner Lehrkraft. Er enthält keine Passwörter oder Codes.</p>
    <!-- focusable so the keyboard can scroll the report -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <pre class="report" tabindex="0" data-testid="bug-report-text">{report}</pre>
    <div class="dialog-actions">
      {#if note}<span class="note" class:err={note.err} role="status" data-testid="bug-report-note">{note.text}</span>{/if}
      <span class="spacer"></span>
      <button class="btn" onclick={onClose} data-testid="bug-report-close">Schließen</button>
      <button class="btn" onclick={() => void save()} data-testid="bug-report-save">Als Datei speichern …</button>
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn primary" onclick={() => void copy()} autofocus data-testid="bug-report-copy">{copied ? "Kopiert" : "Kopieren"}</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--overlay);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dialog {
    width: 640px;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    box-sizing: border-box;
    background: var(--bg-panel);
    border-radius: 14px;
    padding: 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  }
  .dialog-icon {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--bg-selected);
    color: var(--text-link);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    color: var(--text);
  }
  .muted {
    margin: 0;
    font-size: 14px;
    line-height: 21px;
    color: var(--text-muted);
  }
  .report {
    margin: 0;
    min-height: 120px;
    overflow: auto;
    background: var(--bg-app);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: var(--jide-code-font);
    font-size: 12px;
    line-height: 18px;
    color: var(--text);
    white-space: pre;
    user-select: text;
  }
  .dialog-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }
  .spacer {
    flex: 1;
  }
  .note {
    font-size: 12px;
    color: var(--text-ok);
  }
  .note.err {
    color: var(--text-err);
  }
</style>
