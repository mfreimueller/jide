<script lang="ts">
	import { page } from '$app/state';
	import Button from '#lib/components/Button.svelte';
</script>

<div class="box">
	<h1>{page.status === 404 ? 'Nicht gefunden' : 'Etwas ist schiefgelaufen'}</h1>
	<p class="muted">
		{page.status === 404 ? 'Diese Seite gibt es nicht, oder du hast keinen Zugriff darauf.' : (page.error?.message ?? 'Bitte versuche es erneut.')}
	</p>
	<Button href="/">Zur Startseite</Button>
</div>

<style>
	.box {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 48px;
	}
	h1 {
		font-size: 24px;
		font-weight: 700;
	}
</style>
