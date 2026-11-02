<script lang="ts">
	interface Props {
		/** Names the item for screen readers, e.g. „Schleifen“. */
		label: string;
		first: boolean;
		last: boolean;
		onmove: (direction: 'up' | 'down') => void;
	}
	let { label, first, last, onmove }: Props = $props();
</script>

<span class="move">
	<button type="button" aria-label="{label} nach oben" disabled={first} onclick={() => onmove('up')}>▲</button>
	<button type="button" aria-label="{label} nach unten" disabled={last} onclick={() => onmove('down')}>▼</button>
</span>

<style>
	.move {
		display: inline-flex;
		gap: 2px;
	}
	button {
		width: 22px;
		height: 24px;
		padding: 0;
		border: 1px solid var(--border-strong);
		border-radius: 5px;
		background: var(--surface);
		color: var(--text-muted);
		font-size: 9px;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		color: var(--primary);
		border-color: var(--primary-line);
	}
	button:disabled {
		color: var(--text-ghost);
		background: var(--bg);
		cursor: default;
	}
</style>
