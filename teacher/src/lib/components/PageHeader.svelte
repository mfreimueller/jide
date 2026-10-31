<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		crumb?: string;
		crumbHref?: string;
		badge?: Snippet;
		actions?: Snippet;
	}
	let { title, crumb, crumbHref, badge, actions }: Props = $props();
</script>

<header>
	<div class="titles">
		{#if crumb}
			{#if crumbHref}<a class="crumb" href={crumbHref}>{crumb}</a>{:else}<span class="crumb">{crumb}</span>{/if}
		{/if}
		<h1>{title}</h1>
	</div>
	{#if badge}<span class="badge">{@render badge()}</span>{/if}
	<span class="spacer"></span>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	header {
		display: flex;
		align-items: flex-end;
		gap: 14px;
		padding: 26px 36px 18px;
	}
	.titles {
		display: flex;
		flex-direction: column;
	}
	.crumb {
		margin-bottom: 4px;
		font-size: 13px;
		color: var(--text-faint);
		text-decoration: none;
	}
	a.crumb:hover {
		color: var(--primary);
	}
	h1 {
		font-size: 24px;
		font-weight: 700;
	}
	.badge {
		margin-bottom: 4px;
	}
	.actions {
		display: flex;
		gap: 10px;
		align-items: center;
	}
</style>
