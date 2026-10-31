<script lang="ts">
	import Logo from '#lib/components/Logo.svelte';

	let { children } = $props();
</script>

<div class="center">
	<div class="card">
		<Logo size="lg" />
		{@render children()}
	</div>
</div>

<style>
	.center {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 24px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 420px;
		max-width: 100%;
		padding: 40px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.06);
	}
</style>
