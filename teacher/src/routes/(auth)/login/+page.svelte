<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, ApiError } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import TextField from '#lib/components/TextField.svelte';

	let email = $state('');
	let error = $state<string | null>(null);
	let sending = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		sending = true;
		try {
			await api('/teacher/auth/request-link', { method: 'POST', body: { email }, auth: false });
			await goto(`/login/sent?email=${encodeURIComponent(email.trim())}`);
		} catch (err) {
			error = err instanceof ApiError ? friendly(err) : 'Etwas ist schiefgelaufen.';
		} finally {
			sending = false;
		}
	}

	function friendly(err: ApiError): string {
		if (err.code === 'VALIDATION') return 'Bitte gib eine gültige E-Mail-Adresse ein.';
		if (err.code === 'RATE_LIMITED') return 'Zu viele Anfragen. Bitte versuche es in ein paar Minuten erneut.';
		return err.message;
	}
</script>

<svelte:head><title>Anmelden · J;DE Lehrkraft</title></svelte:head>

<p class="muted">Melde dich an, um Kurse, Aufgaben und Abgaben zu verwalten. Wir schicken dir einen Anmelde-Link per E-Mail.</p>

<form onsubmit={submit} novalidate>
	<TextField label="E-Mail-Adresse" type="email" autocomplete="email" bind:value={email} {error} required />
	<Button variant="primary" type="submit" block loading={sending}>Anmelde-Link senden</Button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
</style>
