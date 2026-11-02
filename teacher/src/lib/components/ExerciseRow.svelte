<script lang="ts">
	import { api } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import { messageOf } from '#lib/errors.js';
	import { DEFAULT_DEADLINE_TIME, fromLocalParts, toLocalParts } from '#lib/time.js';
	import type { CourseExercise, ExerciseGroup } from '#lib/types.js';
	import MoveButtons from '#lib/components/MoveButtons.svelte';

	interface Props {
		courseId: number;
		exercise: CourseExercise;
		/** "x / y" or null if there is nothing to count (not unlocked). */
		handIns: string | null;
		isNew?: boolean;
		groups: ExerciseGroup[];
		/** Position inside its group, or null when ungrouped (no arrows). */
		move: { first: boolean; last: boolean } | null;
		onchange: () => void | Promise<void>;
		onmove: (direction: 'up' | 'down') => void;
		ondelete: () => void;
	}
	let { courseId, exercise, handIns, isNew = false, groups, move, onchange, onmove, ondelete }: Props = $props();

	// The parent re-keys this component whenever the saved values change, so the initial values are enough.
	// svelte-ignore state_referenced_locally
	const saved = toLocalParts(exercise.deadline);
	let date = $state(saved.date);
	let time = $state(saved.time || DEFAULT_DEADLINE_TIME);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const dirty = $derived(date !== saved.date || (date !== '' && time !== (saved.time || DEFAULT_DEADLINE_TIME)));

	async function put(body: { unlocked?: boolean; deadline?: string | null; groupId?: number | null }) {
		busy = true;
		error = null;
		try {
			await api(`/teacher/courses/${courseId}/exercises/${encodeURIComponent(exercise.id)}`, { method: 'PUT', body });
			await onchange();
		} catch (err) {
			error = messageOf(err);
		} finally {
			busy = false;
		}
	}

	const setGroup = (e: Event & { currentTarget: HTMLSelectElement }) => {
		const v = e.currentTarget.value;
		return put({ groupId: v === '' ? null : Number(v) });
	};
	const toggle = () => put({ unlocked: !exercise.unlocked });
	const saveDeadline = () => put({ deadline: fromLocalParts(date, time) });
	const clearDeadline = () => put({ deadline: null });
</script>

<tr>
	<td class="move">
		{#if move}
			<MoveButtons label="„{exercise.title}“" first={move.first} last={move.last} {onmove} />
		{/if}
	</td>
	<td>
		<div class="title">
			<span class="stud">{exercise.title}</span>
			{#if isNew}<span class="chip new">neu</span>{/if}
			<span class="small mono id">{exercise.id}</span>
		</div>
	</td>
	<td>
		<button
			class="toggle"
			class:on={exercise.unlocked}
			role="switch"
			aria-checked={exercise.unlocked}
			aria-label="„{exercise.title}“ für diesen Kurs freischalten"
			disabled={busy}
			onclick={toggle}
		></button>
	</td>
	<td>
		<div class="deadline">
			<input type="date" aria-label="Frist: Datum" bind:value={date} oninput={() => { if (date && !time) time = DEFAULT_DEADLINE_TIME; }} />
			<input type="time" aria-label="Frist: Uhrzeit" bind:value={time} disabled={!date} />
			{#if dirty && date}<Button size="sm" variant="primary" loading={busy} onclick={saveDeadline}>Speichern</Button>{/if}
			{#if exercise.deadline && !dirty}<Button size="sm" variant="ghost" loading={busy} onclick={clearDeadline}>Frist entfernen</Button>{/if}
			{#if dirty && !date}<Button size="sm" variant="primary" loading={busy} onclick={clearDeadline}>Frist entfernen</Button>{/if}
		</div>
		{#if error}<p class="alert err" role="alert">{error}</p>{/if}
	</td>
	<td class:small={!handIns}>{handIns ?? 'nicht sichtbar'}</td>
	<td>
		<select aria-label="Gruppe von „{exercise.title}“" value={exercise.groupId === null ? '' : String(exercise.groupId)} disabled={busy} onchange={setGroup}>
			<option value="">–</option>
			{#each groups as g (g.id)}<option value={String(g.id)}>{g.name}</option>{/each}
		</select>
	</td>
	<td class="right"><Button size="sm" onclick={ondelete}>Löschen</Button></td>
</tr>

<style>
	.title {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.stud {
		font-weight: 500;
	}
	.id {
		margin-left: 2px;
	}
	.toggle {
		position: relative;
		width: 36px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: var(--border-strong);
		cursor: pointer;
	}
	.toggle::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		transition: left 0.12s;
	}
	.toggle.on {
		background: var(--primary);
	}
	.toggle.on::after {
		left: 18px;
	}
	.toggle:disabled {
		opacity: 0.6;
	}
	.deadline {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	input {
		height: 30px;
		padding: 0 8px;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--surface);
		font-size: 13px;
	}
	select {
		height: 30px;
		max-width: 160px;
		padding: 0 6px;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--surface);
		font-size: 13px;
	}
	.move {
		width: 1%;
		padding-right: 0;
	}
	input:disabled {
		color: var(--text-ghost);
		background: var(--bg);
	}
	.right {
		text-align: right;
	}
	.err {
		margin-top: 6px;
	}
</style>
