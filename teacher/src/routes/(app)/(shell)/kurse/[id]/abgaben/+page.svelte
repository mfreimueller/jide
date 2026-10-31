<script lang="ts">
	import { download } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { courseLabel } from '#lib/course.svelte.js';
	import { messageOf } from '#lib/errors.js';
	import { cellLabel, cellTone, norm } from '#lib/matrix.js';
	import { formatDay, formatShort } from '#lib/time.js';

	let { data } = $props();
	const course = $derived(data.course);
	const matrix = $derived(data.matrix);

	let query = $state('');
	let onlyMissing = $state(false);
	let zipOpen = $state(false);
	let zipBusy = $state<string | null>(null);
	let error = $state<string | null>(null);

	const rows = $derived(
		matrix.rows
			.map((r, i) => ({ row: r, name: matrix.students[i]?.name ?? '' }))
			.filter(({ row, name }) => norm(name).includes(norm(query.trim())) && (!onlyMissing || row.cells.some((c) => c === null)))
	);
	const handedIn = $derived(matrix.exercises.map((_, j) => matrix.rows.filter((r) => r.cells[j] !== null).length));

	async function zip(id: string) {
		zipOpen = false;
		zipBusy = id;
		error = null;
		try {
			await download(`/teacher/courses/${course.id}/exercises/${encodeURIComponent(id)}/handins.zip`, `${id}-abgaben.zip`);
		} catch (err) {
			error = messageOf(err);
		} finally {
			zipBusy = null;
		}
	}
</script>

<svelte:head><title>Abgaben · {courseLabel(course)} · J;DE Lehrkraft</title></svelte:head>
<svelte:window onkeydown={(e) => e.key === 'Escape' && (zipOpen = false)} />

<PageHeader title="Abgaben" crumb={courseLabel(course)}>
	{#snippet actions()}
		<div class="zip">
			<Button loading={zipBusy !== null} disabled={matrix.exercises.length === 0} onclick={() => (zipOpen = !zipOpen)}>
				⤓ Alle Abgaben einer Aufgabe (ZIP)
			</Button>
			{#if zipOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
				<div class="backdrop" onclick={() => (zipOpen = false)}></div>
				<ul class="menu" aria-label="Aufgabe wählen">
					{#each matrix.exercises as ex (ex.id)}
						<li><button onclick={() => zip(ex.id)}>{ex.title}</button></li>
					{/each}
				</ul>
			{/if}
		</div>
	{/snippet}
</PageHeader>

<div class="body">
	<div class="toolbar">
		<input class="search" type="search" bind:value={query} placeholder="⌕  Schüler:in suchen …" aria-label="Schüler:in suchen" />
		<Button pressed={onlyMissing} onclick={() => (onlyMissing = !onlyMissing)}>Nur fehlende Abgaben</Button>
		<span class="spacer"></span>
		<div class="legend">
			<span><span class="sw" style="background: var(--success-soft)"></span>alle Tests bestanden</span>
			<span><span class="sw" style="background: var(--warn-soft)"></span>Tests teilweise</span>
			<span><span class="sw" style="background: var(--danger-soft)"></span>verspätet</span>
			<span><span class="sw" style="background: var(--surface-alt)"></span>keine Abgabe</span>
		</div>
	</div>

	{#if error}<p class="alert" role="alert">{error}</p>{/if}

	{#if matrix.exercises.length === 0}
		<div class="panel card-pad">
			<span class="card-title">Noch keine Aufgabe freigeschaltet</span>
			<span class="muted">Schalte unter <a href="/kurse/{course.id}/aufgaben">Aufgaben</a> mindestens eine Aufgabe frei, dann erscheinen hier die Abgaben.</span>
		</div>
	{:else}
		<div class="panel table">
			<table class="data">
				<thead>
					<tr>
						<th class="name">Schüler:in</th>
						{#each matrix.exercises as ex, j (ex.id)}
							<th class="ex">
								<div class="ex-head">
									<b>{ex.title}</b>
									<span>{ex.deadline ? `Frist ${formatDay(ex.deadline)} · ` : ''}{handedIn[j]}/{matrix.students.length}</span>
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as { row, name } (row.studentId)}
						<tr>
							<td class="stud">{name}</td>
							{#each row.cells as c, j (matrix.exercises[j]?.id)}
								<td>
									{#if c}
										<a
											class="cell {cellTone(c)}"
											href="/kurse/{course.id}/abgaben/{c.handinId}"
											title={c.count > 1 ? `${c.count} Abgaben, die letzte zählt` : undefined}
										>
											<span class="top">{cellLabel(c)}</span>
											<span class="ts">{formatShort(c.submittedAt)}</span>
										</a>
									{:else}
										<div class="cell none"><span class="top">–</span><span class="ts">keine Abgabe</span></div>
									{/if}
								</td>
							{/each}
						</tr>
					{:else}
						<tr><td colspan={matrix.exercises.length + 1} class="muted empty">
							{matrix.students.length === 0 ? 'Noch keine Schüler:innen in diesem Kurs.' : 'Keine Treffer.'}
						</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<span class="small">Klick auf eine Zelle öffnet die Abgabe. Es zählt immer die letzte Abgabe; „verspätet“ heißt: nach der Frist abgegeben.</span>
</div>

<style>
	.zip {
		position: relative;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
	}
	.menu {
		position: absolute;
		z-index: 11;
		right: 0;
		top: calc(100% + 4px);
		min-width: 240px;
		margin: 0;
		padding: 4px;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}
	.menu button {
		width: 100%;
		padding: 8px 10px;
		border: 0;
		border-radius: 6px;
		background: none;
		text-align: left;
		cursor: pointer;
	}
	.menu button:hover {
		background: var(--surface-alt);
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.search {
		width: 260px;
		height: 40px;
		padding: 0 12px;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 16px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.sw {
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-right: 6px;
		border-radius: 3px;
		vertical-align: -2px;
	}
	.table {
		overflow-x: auto;
	}
	th.name {
		width: 200px;
	}
	th.ex {
		min-width: 150px;
	}
	.ex-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ex-head b {
		color: var(--text);
		font-size: 13px;
	}
	.stud {
		font-weight: 500;
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 8px;
		border-radius: 8px;
		color: inherit;
		text-decoration: none;
	}
	a.cell:hover {
		outline: 2px solid var(--primary-line);
	}
	.cell.ok {
		background: var(--success-soft);
	}
	.cell.part {
		background: var(--warn-soft);
	}
	.cell.late {
		background: var(--danger-soft);
	}
	.cell.none {
		background: var(--bg);
		color: var(--text-ghost);
	}
	.cell.plain {
		background: var(--primary-soft);
	}
	.top {
		font-size: 12px;
		font-weight: 600;
	}
	.ok .top {
		color: var(--success);
	}
	.part .top {
		color: var(--warn);
	}
	.late .top {
		color: var(--danger);
	}
	.plain .top {
		color: var(--primary);
	}
	.ts {
		font-size: 11px;
		color: var(--text-muted);
	}
	.none .ts {
		color: var(--text-ghost);
	}
	.empty {
		padding: 24px 12px;
	}
</style>
