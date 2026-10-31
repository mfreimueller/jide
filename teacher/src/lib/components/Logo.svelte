<script lang="ts">
	let { size = 'md' }: { size?: 'md' | 'lg' } = $props();
</script>

<div class="logo {size}">
	<img src="/icon.svg" alt="" />
	{#if size === 'lg'}
		<span class="line">J;DE <span class="sub">Lehrkraft</span></span>
	{:else}
		<span class="stack">J;DE<span class="sub">Lehrkraft</span></span>
	{/if}
</div>

<style>
	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
	}
	.md {
		font-size: 18px;
	}
	.md img {
		width: 30px;
		height: 30px;
	}
	.lg {
		font-size: 22px;
	}
	.lg img {
		width: 38px;
		height: 38px;
	}
	.stack {
		display: flex;
		flex-direction: column;
	}
	.sub {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-faint);
	}
</style>
