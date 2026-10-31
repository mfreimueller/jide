<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		width?: number;
		children: Snippet;
	}
	let { open = $bindable(), title, width = 520, children }: Props = $props();

	let el = $state<HTMLDialogElement>();
	const uid = $props.id();

	// The native <dialog> gives us the focus trap, Escape to close and focus return.
	$effect(() => {
		if (!el) return;
		if (open && !el.open) el.showModal();
		else if (!open && el.open) el.close();
	});
</script>

<dialog
	bind:this={el}
	aria-labelledby="{uid}-title"
	style:max-width="{width}px"
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === el) open = false;
	}}
>
	{#if open}
		<div class="body">
			<h2 id="{uid}-title">{title}</h2>
			{@render children()}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		width: calc(100% - 32px);
		padding: 0;
		border: 0;
		border-radius: 16px;
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 24px 64px rgb(22 24 29 / 0.3);
	}
	dialog::backdrop {
		background: rgb(22 24 29 / 0.55);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 32px;
	}
	h2 {
		font-size: 20px;
		font-weight: 700;
	}
</style>
