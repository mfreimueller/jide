<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { api, upload } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import ExerciseRow from '#lib/components/ExerciseRow.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { courseLabel, courseStore } from '#lib/course.svelte.js';
	import { messageOf } from '#lib/errors.js';
	import type { Exercise } from '#lib/types.js';

	let { data } = $props();
	const course = $derived(data.course);

	let input = $state<HTMLInputElement>();
	let dragging = $state(false);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);
	let result = $state<{ exercise: Exercise; replaced: boolean } | null>(null);

	interface Usage {
		courses: { id: number; subject: string; className: string }[];
		handInCount: number;
	}
	let deleteTarget = $state<Exercise | null>(null);
	let deleteUsage = $state<Usage | null>(null);
	let deleteOpen = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	const courseList = $derived(deleteUsage?.courses.map(courseLabel).join(', ') ?? '');
	const handInText = $derived(deleteUsage?.handInCount === 1 ? '1 Abgabe wird' : `${deleteUsage?.handInCount} Abgaben werden`);
	const deleteText = $derived(
		deleteUsage
			? `Die Aufgabe wird aus allen Kursen entfernt${deleteUsage.courses.length > 0 ? ` (${courseList})` : ''}.` +
					(deleteUsage.handInCount > 0 ? ` ${handInText} endgültig gelöscht.` : '')
			: ''
	);

	async function askDelete(ex: Exercise) {
		deleteTarget = ex;
		deleteUsage = null;
		deleteError = null;
		deleteOpen = true;
		try {
			deleteUsage = await api<Usage>(`/teacher/exercises/${encodeURIComponent(ex.id)}/usage`);
		} catch (err) {
			deleteError = messageOf(err);
		}
	}

	async function remove() {
		if (!deleteTarget) return;
		deleting = true;
		deleteError = null;
		try {
			await api(`/teacher/exercises/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
			deleteOpen = false;
			await invalidate('app:exercises');
		} catch (err) {
			deleteError = messageOf(err);
		} finally {
			deleting = false;
		}
	}

	$effect(() => {
		courseStore.exerciseCount = data.exercises.length;
	});

	async function send(file: File | undefined) {
		if (!file) return;
		uploadError = null;
		result = null;
		if (!/\.zip$/i.test(file.name)) {
			uploadError = 'Bitte eine ZIP-Datei auswählen.';
			return;
		}
		uploading = true;
		try {
			const res = await upload<{ exercise: Exercise; replaced: boolean }>('/teacher/exercises', file, 'application/zip');
			result = res.data;
			await invalidate('app:exercises');
		} catch (err) {
			uploadError = messageOf(err);
		} finally {
			uploading = false;
			if (input) input.value = '';
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		send(e.dataTransfer?.files[0]);
	}
</script>

<svelte:head><title>Aufgaben · {courseLabel(course)} · J;DE Lehrkraft</title></svelte:head>

<PageHeader title="Aufgaben" crumb={courseLabel(course)} />

<div class="body">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="drop"
		class:dragging
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
	>
		<div class="drop-ico" aria-hidden="true">⤒</div>
		<div class="drop-text">
			<span class="drop-title">Aufgabe hochladen</span>
			<span class="muted">ZIP-Datei eines Aufgabenordners hierher ziehen (mit exercise.yaml, aufgabe.md, files/, tests.yaml).</span>
		</div>
		<Button loading={uploading} onclick={() => input?.click()}>Datei auswählen</Button>
		<input bind:this={input} type="file" accept=".zip,application/zip" hidden onchange={() => send(input?.files?.[0])} />
	</div>

	{#if uploadError}
		<div class="panel card-pad fail" role="alert">
			<span class="mark">✗</span>
			<div class="res-text">
				<span class="res-title">Hochladen nicht möglich</span>
				<span class="muted">{uploadError}</span>
			</div>
		</div>
	{:else if result}
		<div class="panel card-pad ok" role="status">
			<span class="mark">✓</span>
			<div class="res-text">
				<span class="res-title">„{result.exercise.title}“ {result.replaced ? 'aktualisiert' : 'hochgeladen'}</span>
				<span class="small">
					Format geprüft · {result.replaced ? 'Freischaltung und Frist bleiben erhalten' : 'noch nicht freigeschaltet'}
				</span>
			</div>
		</div>
	{/if}

	<div class="panel table">
		<table class="data">
			<thead>
				<tr><th>Aufgabe</th><th>Freigeschaltet</th><th>Frist (Wiener Zeit)</th><th>Abgaben</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.exercises as ex (ex.id)}
					{#key `${ex.id}|${ex.deadline}|${ex.unlocked}`}
						<ExerciseRow
							courseId={course.id}
							exercise={ex}
							handIns={ex.unlocked ? (data.handIns[ex.id] ?? null) : null}
							isNew={result?.exercise.id === ex.id && !result.replaced}
							onchange={() => invalidate('app:exercises')}
							ondelete={() => askDelete(ex)}
						/>
					{/key}
				{:else}
					<tr><td colspan="5" class="muted empty">Noch keine Aufgaben. Lade oben die erste hoch.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<span class="small">Die Frist ist weich: Abgaben danach werden angenommen und als „verspätet“ markiert.</span>
</div>

<Dialog bind:open={deleteOpen} title="„{deleteTarget?.title}“ löschen?" width={460}>
	{#if deleteUsage}
		<p class="muted">{deleteText}</p>
	{/if}
	{#if deleteError}<p class="alert" role="alert">{deleteError}</p>{/if}
	<div class="dialog-actions">
		<Button onclick={() => (deleteOpen = false)}>Abbrechen</Button>
		<Button variant="danger" loading={deleting} disabled={!deleteUsage} onclick={remove}>Löschen</Button>
	</div>
</Dialog>

<style>
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
	.drop {
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 22px;
		border: 2px dashed var(--primary-line);
		border-radius: var(--radius-lg);
		background: var(--primary-wash);
	}
	.drop.dragging {
		background: var(--primary-soft);
	}
	.drop-ico {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 10px;
		background: var(--primary-soft);
		color: var(--primary);
		font-size: 22px;
		font-weight: 700;
	}
	.drop-text {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}
	.drop-title {
		font-size: 15px;
		font-weight: 600;
	}
	.ok,
	.fail {
		flex-direction: row;
		align-items: center;
		gap: 14px;
	}
	.ok {
		border-color: var(--success-line);
		background: var(--success-wash);
	}
	.fail {
		border-color: #f4b6b8;
		background: #fff8f8;
	}
	.ok .mark {
		color: var(--success);
		font-weight: 700;
	}
	.fail .mark {
		color: var(--danger);
		font-weight: 700;
	}
	.res-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}
	.res-title {
		font-size: 14px;
		font-weight: 600;
	}
	.table {
		overflow: hidden;
	}
	.empty {
		padding: 24px 12px;
	}
</style>
