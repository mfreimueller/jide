<script lang="ts">
	import { api } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import TextField from '#lib/components/TextField.svelte';
	import { courseLabel, courseStore } from '#lib/course.svelte.js';
	import { messageOf } from '#lib/errors.js';
	import type { Course } from '#lib/types.js';

	let subject = $state('');
	let className = $state('');
	let showArchived = $state(false);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let busyId = $state<number | null>(null);

	const shown = $derived(courseStore.courses.filter((c) => showArchived || !c.archived));
	const archivedCount = $derived(courseStore.courses.filter((c) => c.archived).length);

	async function create(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		saving = true;
		try {
			await api<{ course: Course }>('/teacher/courses', { method: 'POST', body: { subject, className } });
			subject = '';
			className = '';
			await courseStore.refresh();
		} catch (err) {
			error = messageOf(err);
		} finally {
			saving = false;
		}
	}

	async function setArchived(c: Course, archive: boolean) {
		busyId = c.id;
		error = null;
		try {
			await api(`/teacher/courses/${c.id}/${archive ? 'archive' : 'unarchive'}`, { method: 'POST', body: {} });
			await courseStore.refresh();
		} catch (err) {
			error = messageOf(err);
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head><title>Kurse verwalten · J;DE Lehrkraft</title></svelte:head>

<PageHeader title="Kurse verwalten" crumb="Kurse" />

<div class="body">
	<div class="split">
		<div class="panel list">
			<div class="toolbar">
				<span class="card-title">Deine Kurse</span>
				<span class="spacer"></span>
				{#if archivedCount > 0 || showArchived}
					<Button size="sm" pressed={showArchived} onclick={() => (showArchived = !showArchived)}>
						Archivierte anzeigen{archivedCount ? ` (${archivedCount})` : ''}
					</Button>
				{/if}
			</div>
			<table class="data">
				<thead>
					<tr><th>Kurs</th><th>Schüler:innen</th><th></th></tr>
				</thead>
				<tbody>
					{#each shown as c (c.id)}
						<tr class:archived={c.archived}>
							<td class="stud">
								{#if c.archived}
									{courseLabel(c)} <span class="chip grey">archiviert</span>
								{:else}
									<a href="/kurse/{c.id}/abgaben">{courseLabel(c)}</a>
								{/if}
							</td>
							<td>{c.studentCount}</td>
							<td class="right">
								<Button size="sm" loading={busyId === c.id} onclick={() => setArchived(c, !c.archived)}>
									{c.archived ? 'Wiederherstellen' : 'Archivieren'}
								</Button>
							</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="muted empty">Noch kein Kurs vorhanden. Lege rechts deinen ersten Kurs an.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="infocol">
			<form class="panel card-pad" onsubmit={create}>
				<span class="card-title">Kurs anlegen</span>
				<TextField label="Fach" bind:value={subject} placeholder="z. B. POS" required />
				<TextField label="Klasse" bind:value={className} placeholder="z. B. 1AHIF" required />
				{#if error}<p class="alert" role="alert">{error}</p>{/if}
				<Button variant="primary" type="submit" loading={saving}>Kurs anlegen</Button>
			</form>
			<div class="panel card-pad">
				<span class="card-title">Hinweis</span>
				<span class="muted">Archivierte Kurse verschwinden aus der Kursauswahl. Schüler:innen und Abgaben bleiben erhalten.</span>
			</div>
		</div>
	</div>
</div>

<style>
	.list {
		flex: 1;
		overflow: hidden;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 12px 12px 18px;
		border-bottom: 1px solid var(--border);
	}
	.stud {
		font-weight: 500;
	}
	.stud a {
		color: inherit;
		text-decoration: none;
	}
	.stud a:hover {
		color: var(--primary);
	}
	.archived .stud {
		color: var(--text-muted);
	}
	.right {
		text-align: right;
	}
	.empty {
		padding: 24px 12px;
	}
	form {
		display: flex;
		flex-direction: column;
	}
</style>
