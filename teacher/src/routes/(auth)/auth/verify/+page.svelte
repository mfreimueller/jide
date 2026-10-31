<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { api, ApiError } from '#lib/api.js';
	import { auth, type Teacher } from '#lib/auth.svelte.js';
	import Button from '#lib/components/Button.svelte';

	let phase = $state<'checking' | 'expired' | 'invalid' | 'error'>('checking');
	let errorMessage = $state('');

	onMount(async () => {
		const token = page.url.searchParams.get('token');
		if (!token) {
			phase = 'invalid';
			return;
		}
		try {
			const res = await api<{ token: string; expiresAt: string; teacher: Teacher }>('/teacher/auth/verify', {
				method: 'POST',
				body: { token },
				auth: false
			});
			auth.set(res);
			await goto('/', { replaceState: true });
		} catch (err) {
			if (err instanceof ApiError && err.code === 'LINK_EXPIRED') phase = 'expired';
			else if (err instanceof ApiError && err.code === 'LINK_INVALID') phase = 'invalid';
			else {
				phase = 'error';
				errorMessage = err instanceof ApiError ? err.message : 'Etwas ist schiefgelaufen.';
			}
		}
	});
</script>

<svelte:head><title>Anmeldung · J;DE Lehrkraft</title></svelte:head>

{#if phase === 'checking'}
	<p class="muted" role="status">Du wirst angemeldet …</p>
{:else if phase === 'expired'}
	<h1>Dieser Link ist abgelaufen</h1>
	<p class="muted">Anmelde-Links gelten 15 Minuten und können nur einmal verwendet werden. Fordere einen neuen an, um fortzufahren.</p>
	<Button variant="primary" block href="/login">Neuen Link senden</Button>
{:else if phase === 'invalid'}
	<h1>Dieser Link funktioniert nicht</h1>
	<p class="muted">Er wurde schon verwendet oder ist ungültig. Fordere einen neuen an, um fortzufahren.</p>
	<Button variant="primary" block href="/login">Neuen Link senden</Button>
{:else}
	<h1>Anmeldung nicht möglich</h1>
	<p class="muted">{errorMessage}</p>
	<Button variant="primary" block href="/login">Zurück zur Anmeldung</Button>
{/if}

<style>
	h1 {
		font-size: 24px;
		font-weight: 700;
	}
</style>
