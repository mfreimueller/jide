<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { api, ApiError } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';

	const email = $derived(page.url.searchParams.get('email') ?? '');
	const COOLDOWN = 45;

	let seconds = $state(COOLDOWN);
	let message = $state<string | null>(null);
	let resending = $state(false);

	onMount(() => {
		const id = setInterval(() => {
			if (seconds > 0) seconds -= 1;
		}, 1000);
		return () => clearInterval(id);
	});

	async function resend() {
		resending = true;
		message = null;
		try {
			await api('/teacher/auth/request-link', { method: 'POST', body: { email }, auth: false });
			seconds = COOLDOWN;
			message = 'Wir haben dir einen neuen Link geschickt.';
		} catch (err) {
			message = err instanceof ApiError && err.code !== 'RATE_LIMITED' ? err.message : 'Zu viele Anfragen. Bitte versuche es in ein paar Minuten erneut.';
		} finally {
			resending = false;
		}
	}

	const label = $derived(seconds > 0 ? `Link erneut senden in 0:${String(seconds).padStart(2, '0')}` : 'Link erneut senden');
</script>

<svelte:head><title>Link wurde gesendet · J;DE Lehrkraft</title></svelte:head>

<div class="icon" aria-hidden="true">✉</div>
<div class="head">
	<h1>Link wurde gesendet</h1>
	<p class="muted">
		Wenn <strong>{email || 'deine Adresse'}</strong> registriert ist, ist ein Anmelde-Link unterwegs. Er funktioniert einmal und läuft
		nach 15 Minuten ab.
	</p>
</div>
<p class="tip">Noch nichts angekommen? Schau auch im Spam-Ordner nach.</p>
<div class="actions">
	<Button block disabled={seconds > 0} loading={resending} onclick={resend}>{label}</Button>
	<Button variant="ghost" block href="/login">Andere E-Mail-Adresse verwenden</Button>
</div>
<p class="status" role="status">{message ?? ''}</p>

<style>
	.icon {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--primary-soft);
		color: var(--primary);
		font-size: 26px;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	h1 {
		font-size: 24px;
		font-weight: 700;
	}
	.tip {
		padding: 12px 14px;
		border-radius: 10px;
		background: var(--surface-alt);
		color: var(--text-muted);
		font-size: 13px;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.status {
		min-height: 1.5em;
		color: var(--text-muted);
		font-size: 13px;
	}
</style>
