<script lang="ts">
  import { onMount } from "svelte";
  import iconUrl from "../assets/icon.svg";
  import type { StudentInfo } from "../../../shared-types/api";

  let { notice = "", onLoggedIn }: { notice?: string; onLoggedIn: (s: StudentInfo) => void } = $props();

  const LENGTH = 8;
  let code = $state("");
  let busy = $state(false);
  let error = $state("");
  let input: HTMLInputElement;

  const chars = $derived(Array.from({ length: LENGTH }, (_, i) => code[i] ?? ""));
  const ready = $derived(code.length === LENGTH && !busy);

  onMount(() => {
    input.focus();
    // Tell main that a screen has rendered (smoke test).
    requestAnimationFrame(() => window.jide.notifyEditorReady());
  });

  /** Letters and digits only, upper case: works for typing, pasting "k7m4-p9xz" and pasting with spaces. */
  function clean(raw: string): string {
    return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, LENGTH);
  }

  function onInput(): void {
    code = clean(input.value);
    input.value = code;
    error = "";
  }

  async function submit(e?: Event): Promise<void> {
    e?.preventDefault();
    if (!ready) return;
    busy = true;
    error = "";
    try {
      const r = await window.jide.login(code);
      if (r.ok) onLoggedIn(r.student);
      else error = r.message;
    } catch {
      error = "Das hat leider nicht geklappt.";
    } finally {
      busy = false;
      input?.focus();
    }
  }
</script>

<div class="screen">
  <div class="center">
    <form class="card" onsubmit={submit}>
      <div class="logo"><img class="logo-mark" src={iconUrl} alt="" />J;DE</div>
      <div class="intro">
        <h1>Willkommen!</h1>
        <p class="muted">
          Gib deinen persönlichen Code ein. Du findest ihn auf dem Zettel, den du von deiner Lehrkraft bekommen hast.
        </p>
      </div>
      <div class="field">
        <label class="label" for="code">Dein Code</label>
        <div class="codeinput" data-testid="code-boxes">
          {#each chars as c, i (i)}
            <div class="codebox" class:focus={i === Math.min(code.length, LENGTH - 1)}>{c}</div>
            {#if i === 3}<span class="dash">–</span>{/if}
          {/each}
          <input
            id="code"
            bind:this={input}
            class="capture"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            aria-label="Dein Code"
            data-testid="code-input"
            oninput={onInput}
          />
        </div>
      </div>
      {#if error}
        <p class="error" role="alert" data-testid="login-error">{error}</p>
      {:else if notice}
        <p class="notice" role="alert" data-testid="login-notice">{notice}</p>
      {/if}
      <button class="btn primary big" type="submit" disabled={!ready}>Anmelden</button>
      <p class="small">
        Code verloren? Frag deine Lehrkraft – sie kann dir einen neuen geben. Du musst den Code nur einmal eingeben.
      </p>
    </form>
  </div>
</div>

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-app);
  }
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: var(--bg-panel);
    border: 1px solid var(--border);
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
    color: var(--text-muted);
    font-size: 14px;
    line-height: 20px;
  }
  .small {
    margin: 0;
    font-size: 12px;
    color: var(--text-faint);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-2);
  }
  .codeinput {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .codebox {
    width: 44px;
    height: 52px;
    border: 1.5px solid var(--border-strong);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 600;
    font-family: var(--jide-code-font);
    background: var(--bg-panel);
  }
  .codebox.focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .dash {
    color: var(--text-disabled);
    font-size: 22px;
  }
  /* The real input lies invisibly over the boxes: typing, pasting and focus all just work. */
  .capture {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    border: none;
    padding: 0;
    cursor: text;
    font-size: 16px;
  }
  .btn.big {
    height: 44px;
    font-size: 16px;
    padding: 0 22px;
    justify-content: center;
  }
  .btn:disabled {
    background: var(--primary-off);
    border-color: var(--primary-off);
    cursor: default;
  }
  .error,
  .notice {
    margin: 0;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 19px;
  }
  .error {
    background: var(--bg-err);
    border: 1px solid var(--border-err);
    color: var(--text-err);
  }
  .notice {
    background: var(--bg-warn);
    border: 1px solid var(--border-warn);
    color: var(--text-warn);
  }
</style>
