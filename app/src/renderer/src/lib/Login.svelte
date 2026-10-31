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
    background: #f8f9fa;
  }
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: #fff;
    border: 1px solid #e3e6e8;
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
    color: #60646c;
    font-size: 14px;
    line-height: 20px;
  }
  .small {
    margin: 0;
    font-size: 12px;
    color: #80838d;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .label {
    font-size: 13px;
    font-weight: 500;
    color: #3a3f45;
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
    border: 1.5px solid #d9dcdf;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 600;
    font-family: var(--jide-code-font);
    background: #fff;
  }
  .codebox.focus {
    border-color: #2f5bd3;
    box-shadow: 0 0 0 3px rgba(47, 91, 211, 0.15);
  }
  .dash {
    color: #b0b4ba;
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
    background: #a9bdf0;
    border-color: #a9bdf0;
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
    background: #feebec;
    border: 1px solid #f5c2c4;
    color: #ce2c31;
  }
  .notice {
    background: #fff4d5;
    border: 1px solid #ffdc8f;
    color: #ab6400;
  }
</style>
