<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { api } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { courseLabel, courseStore } from '#lib/course.svelte.js';
	import { messageOf } from '#lib/errors.js';
	import { formatRelative } from '#lib/time.js';
	import type { Student } from '#lib/types.js';

	let { data } = $props();
	const course = $derived(data.course);
	const students = $derived(data.students);

	let names = $state('');
	let adding = $state(false);
	let error = $state<string | null>(null);
	let resetTarget = $state<Student | null>(null);
	let resetOpen = $state(false);
	let resetting = $state(false);
	let resetError = $state<string | null>(null);

	const nameCount = $derived(new Set(names.split('\n').map((n) => n.trim()).filter(Boolean)).size);

	async function add(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		adding = true;
		try {
			await api(`/teacher/courses/${course.id}/students`, { method: 'POST', body: { names } });
			names = '';
			await Promise.all([invalidate('app:students'), courseStore.refresh()]);
		} catch (err) {
			error = messageOf(err);
		} finally {
			adding = false;
		}
	}

	function askReset(s: Student) {
		resetTarget = s;
		resetError = null;
		resetOpen = true;
	}

	async function reset() {
		if (!resetTarget) return;
		resetting = true;
		resetError = null;
		try {
			await api(`/teacher/courses/${course.id}/students/${resetTarget.id}/reset-code`, { method: 'POST', body: {} });
			resetOpen = false;
			await invalidate('app:students');
		} catch (err) {
			resetError = messageOf(err);
		} finally {
			resetting = false;
		}
	}
</script>

<svelte:head><title>Schüler:innen · {courseLabel(course)} · J;DE Lehrkraft</title></svelte:head>

<PageHeader title="Schüler:innen" crumb={courseLabel(course)}>
	{#snippet actions()}
		<Button href="/kurse/{course.id}/codezettel">⎙ Codezettel drucken</Button>
	{/snippet}
</PageHeader>

<div class="body">
	<div class="split">
		<div class="panel table">
			<table class="data">
				<thead>
					<tr><th>Name</th><th>Persönlicher Code</th><th>Zuletzt aktiv</th><th>Abgaben</th><th></th></tr>
				</thead>
				<tbody>
					{#each students as s (s.id)}
						<tr>
							<td class="stud">{s.name}</td>
							<td><span class="code-pill">{s.code}</span></td>
							<td>
								<span class="dot" class:never={s.lastActivityAt === null}></span>{formatRelative(s.lastActivityAt)}
							</td>
							<td>{s.handInCount} / {s.unlockedExerciseCount}</td>
							<td class="right"><Button size="sm" onclick={() => askReset(s)}>Code zurücksetzen</Button></td>
						</tr>
					{:else}
						<tr><td colspan="5" class="muted empty">Noch keine Schüler:innen. Füge rechts Namen hinzu.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="infocol">
			<form class="panel card-pad" onsubmit={add}>
				<span class="card-title">Schüler:innen hinzufügen</span>
				<span class="muted">Ein Name pro Zeile. Jede Person bekommt automatisch einen persönlichen Code.</span>
				<textarea bind:value={names} rows="9" aria-label="Namen, einer pro Zeile" placeholder={'Ida Hofer\nJonas Lehner'}></textarea>
				{#if error}<p class="alert" role="alert">{error}</p>{/if}
				<Button variant="primary" type="submit" loading={adding} disabled={nameCount === 0}>
					{nameCount === 1 ? '1 Code erzeugen' : nameCount === 0 ? 'Codes erzeugen' : `${nameCount} Codes erzeugen`}
				</Button>
			</form>
			<div class="panel card-pad">
				<span class="card-title">Hinweis</span>
				<span class="muted">„Code zurücksetzen“ macht den alten Code ungültig. Abgaben bleiben erhalten.</span>
			</div>
		</div>
	</div>
</div>

<Dialog bind:open={resetOpen} title="Code zurücksetzen?" width={460}>
	<p class="muted">
		Für <strong>{resetTarget?.name}</strong> wird ein neuer Code erzeugt. Der alte Code funktioniert sofort nicht mehr – die Person
		braucht den neuen Zettel. Bisherige Abgaben bleiben erhalten.
	</p>
	{#if resetError}<p class="alert" role="alert">{resetError}</p>{/if}
	<div class="dialog-actions">
		<Button onclick={() => (resetOpen = false)}>Abbrechen</Button>
		<Button variant="primary" loading={resetting} onclick={reset}>Code zurücksetzen</Button>
	</div>
</Dialog>

<style>
	.table {
		flex: 1;
		overflow: hidden;
	}
	.stud {
		font-weight: 500;
	}
	.right {
		text-align: right;
	}
	.empty {
		padding: 24px 12px;
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 6px;
		border-radius: 50%;
		background: var(--success-dot);
	}
	.dot.never {
		background: var(--danger-dot);
	}
	form {
		display: flex;
		flex-direction: column;
	}
	textarea {
		height: 210px;
		padding: 10px 12px;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--surface);
		font-size: 13px;
		line-height: 21px;
		resize: vertical;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
</style>
