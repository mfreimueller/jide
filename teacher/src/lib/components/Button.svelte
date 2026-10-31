<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	interface Props {
		variant?: Variant;
		size?: 'md' | 'sm';
		type?: 'button' | 'submit';
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		block?: boolean;
		pressed?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}
	let {
		variant = 'secondary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		block = false,
		pressed,
		onclick,
		children
	}: Props = $props();
</script>

{#if href}
	<a class="btn {variant} {size}" class:block {href}>{@render children()}</a>
{:else}
	<button
		class="btn {variant} {size}"
		class:block
		{type}
		disabled={disabled || loading}
		aria-busy={loading}
		aria-pressed={pressed}
		{onclick}
	>
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 34px;
		padding: 0 14px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn:hover:not(:disabled) {
		background: var(--surface-alt);
	}
	.sm {
		height: 28px;
		font-size: 12px;
		padding: 0 10px;
	}
	.block {
		display: flex;
		width: 100%;
		height: 42px;
		font-size: 15px;
	}
	.primary {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--text-inverse);
	}
	.primary:hover:not(:disabled) {
		background: var(--primary-dark);
	}
	.ghost {
		border-color: transparent;
		background: transparent;
		color: var(--text-muted);
	}
	.danger {
		color: var(--danger);
	}
	.btn[aria-pressed='true'] {
		background: var(--primary-soft);
		border-color: var(--primary-line);
		color: var(--primary);
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
