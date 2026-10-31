<script lang="ts">
	interface Props {
		label: string;
		value: string;
		type?: 'text' | 'email';
		min?: number;
		max?: number;
		placeholder?: string;
		autocomplete?: 'email' | 'off';
		error?: string | null;
		hint?: string;
		required?: boolean;
	}
	let {
		label,
		value = $bindable(),
		type = 'text',
		min,
		max,
		placeholder,
		autocomplete = 'off',
		error = null,
		hint,
		required = false
	}: Props = $props();

	const uid = $props.id();
</script>

<div class="field">
	<label for="{uid}-input">{label}</label>
	<input
		id="{uid}-input"
		{type}
		{min}
		{max}
		{placeholder}
		{autocomplete}
		{required}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${uid}-error` : hint ? `${uid}-hint` : undefined}
	/>
	{#if error}
		<p class="error" id="{uid}-error" role="alert">{error}</p>
	{:else if hint}
		<p class="hint" id="{uid}-hint">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-size: 13px;
		font-weight: 500;
	}
	input {
		height: 40px;
		padding: 0 12px;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--surface);
		font-size: 14px;
	}
	input::placeholder {
		color: var(--text-muted);
	}
	input[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.error {
		color: var(--danger);
		font-size: 13px;
	}
	.hint {
		color: var(--text-muted);
		font-size: 13px;
	}
</style>
