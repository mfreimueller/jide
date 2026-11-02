<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { api, upload } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import TextField from '#lib/components/TextField.svelte';
	import ExerciseRow from '#lib/components/ExerciseRow.svelte';
	import MoveButtons from '#lib/components/MoveButtons.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { courseLabel, courseStore } from '#lib/course.svelte.js';
	import { messageOf } from '#lib/errors.js';
	import type { Exercise, ExerciseGroup } from '#lib/types.js';

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

	// ---- groups ----
	const base = $derived(`/teacher/courses/${course.id}`);
	let groupError = $state<string | null>(null);

	// Without groups the table is one plain list; with groups every group gets a header and the rest goes under "Ohne Gruppe".
	const sections = $derived([
		...data.groups.map((group) => ({ group, items: data.exercises.filter((e) => e.groupId === group.id) })),
		{ group: null as ExerciseGroup | null, items: data.exercises.filter((e) => e.groupId === null) }
	]);
	const hasGroups = $derived(data.groups.length > 0);

	async function groupCall(path: string, method: 'POST', body?: unknown) {
		groupError = null;
		try {
			await api(`${base}${path}`, { method, body });
			await invalidate('app:exercises');
			return true;
		} catch (err) {
			groupError = messageOf(err);
			return false;
		}
	}
	const moveGroup = (g: ExerciseGroup, direction: 'up' | 'down') => groupCall(`/groups/${g.id}/move`, 'POST', { direction });
	const moveExercise = (e: Exercise, direction: 'up' | 'down') =>
		groupCall(`/exercises/${encodeURIComponent(e.id)}/move`, 'POST', { direction });

	// create / rename dialog
	let nameOpen = $state(false);
	let nameTarget = $state<ExerciseGroup | null>(null);
	let nameValue = $state('');
	let nameBusy = $state(false);
	let nameError = $state<string | null>(null);

	function openName(g: ExerciseGroup | null) {
		nameTarget = g;
		nameValue = g?.name ?? '';
		nameError = null;
		nameOpen = true;
	}
	async function saveName(e: Event) {
		e.preventDefault();
		const name = nameValue.trim();
		if (name === '') {
			nameError = 'Bitte einen Namen eingeben.';
			return;
		}
		nameBusy = true;
		nameError = null;
		try {
			if (nameTarget) await api(`${base}/groups/${nameTarget.id}`, { method: 'PUT', body: { name } });
			else await api(`${base}/groups`, { method: 'POST', body: { name } });
			nameOpen = false;
			await invalidate('app:exercises');
		} catch (err) {
			nameError = messageOf(err);
		} finally {
			nameBusy = false;
		}
	}

	// delete dialog
	let removeTarget = $state<ExerciseGroup | null>(null);
	let removeOpen = $state(false);
	let removing = $state(false);
	let removeError = $state<string | null>(null);
	function askRemoveGroup(g: ExerciseGroup) {
		removeTarget = g;
		removeError = null;
		removeOpen = true;
	}
	async function removeGroup() {
		if (!removeTarget) return;
		removing = true;
		removeError = null;
		try {
			await api(`${base}/groups/${removeTarget.id}`, { method: 'DELETE' });
			removeOpen = false;
			await invalidate('app:exercises');
		} catch (err) {
			removeError = messageOf(err);
		} finally {
			removing = false;
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

	<div class="group-bar">
		<span class="small">Gruppen ordnen die Aufgaben in der Liste der Schüler:innen. Reihenfolge mit ▲ ▼.</span>
		<Button size="sm" onclick={() => openName(null)}>+ Neue Gruppe</Button>
	</div>
	{#if groupError}<p class="alert" role="alert">{groupError}</p>{/if}

	<div class="panel table">
		<table class="data">
			<thead>
				<tr><th class="narrow"></th><th>Aufgabe</th><th>Freigeschaltet</th><th>Frist (Wiener Zeit)</th><th>Abgaben</th><th>Gruppe</th><th></th></tr>
			</thead>
			<tbody>
				{#each sections as section, si (section.group?.id ?? 'none')}
					{#if hasGroups}
						{#if section.group}
							{@const g = section.group}
							<tr class="group-row">
								<td class="narrow"><MoveButtons label="Gruppe „{g.name}“" first={si === 0} last={si === data.groups.length - 1} onmove={(d) => moveGroup(g, d)} /></td>
								<!-- name and actions share one wide cell, so the actions don't widen the last column -->
								<td colspan="6">
									<div class="group-head">
										<span>
											<span class="group-name">{g.name}</span>
											<span class="small count">{section.items.length} {section.items.length === 1 ? 'Aufgabe' : 'Aufgaben'}</span>
										</span>
										<span class="group-actions">
											<button type="button" class="link" onclick={() => openName(g)}>Umbenennen</button>
											<button type="button" class="link" onclick={() => askRemoveGroup(g)}>Löschen</button>
										</span>
									</div>
								</td>
							</tr>
						{:else}
							<tr class="group-row">
								<td class="narrow"></td>
								<td colspan="6">
									<span class="group-name">Ohne Gruppe</span>
									<span class="small count">Schüler:innen sehen diese unter „Weitere Übungen“</span>
								</td>
							</tr>
						{/if}
					{/if}
					{#each section.items as ex, i (ex.id)}
						{#key `${ex.id}|${ex.deadline}|${ex.unlocked}|${ex.groupId}`}
							<ExerciseRow
								courseId={course.id}
								exercise={ex}
								groups={data.groups}
								move={section.group ? { first: i === 0, last: i === section.items.length - 1 } : null}
								handIns={ex.unlocked ? (data.handIns[ex.id] ?? null) : null}
								isNew={result?.exercise.id === ex.id && !result.replaced}
								onchange={() => invalidate('app:exercises')}
								onmove={(d) => moveExercise(ex, d)}
								ondelete={() => askDelete(ex)}
							/>
						{/key}
					{/each}
				{/each}
				{#if data.exercises.length === 0}
					<tr><td colspan="7" class="muted empty">Noch keine Aufgaben. Lade oben die erste hoch.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
	<span class="small">Die Frist ist weich: Abgaben danach werden angenommen und als „verspätet“ markiert.</span>
</div>

<Dialog bind:open={nameOpen} title={nameTarget ? 'Gruppe umbenennen' : 'Neue Gruppe'} width={420}>
	<form class="name-form" onsubmit={saveName}>
		<TextField label="Name" bind:value={nameValue} max={100} error={nameError} required />
		<div class="dialog-actions">
			<Button onclick={() => (nameOpen = false)}>Abbrechen</Button>
			<Button type="submit" variant="primary" loading={nameBusy}>{nameTarget ? 'Speichern' : 'Anlegen'}</Button>
		</div>
	</form>
</Dialog>

<Dialog bind:open={removeOpen} title="Gruppe „{removeTarget?.name}“ löschen?" width={460}>
	<p class="muted">Die Aufgaben bleiben erhalten und stehen danach unter „Ohne Gruppe“.</p>
	{#if removeError}<p class="alert" role="alert">{removeError}</p>{/if}
	<div class="dialog-actions">
		<Button onclick={() => (removeOpen = false)}>Abbrechen</Button>
		<Button variant="danger" loading={removing} onclick={removeGroup}>Löschen</Button>
	</div>
</Dialog>

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
	.group-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.name-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	:global(table.data tr.group-row td) {
		background: var(--surface-alt);
	}
	.group-name {
		font-weight: 600;
	}
	.count {
		margin-left: 10px;
	}
	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.group-actions {
		white-space: nowrap;
	}
	.link {
		margin-left: 14px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--primary);
		font-size: 13px;
		cursor: pointer;
	}
	.link:hover {
		text-decoration: underline;
	}
	:global(table.data th.narrow),
	:global(table.data td.narrow) {
		width: 1%;
		padding-right: 0;
	}
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
