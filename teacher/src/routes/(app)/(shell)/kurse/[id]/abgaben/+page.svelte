<script lang="ts">
	import { api, download } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { courseLabel } from '#lib/course.svelte.js';
	import { messageOf } from '#lib/errors.js';
	import {
		cellLabel,
		cellTone,
		chipLabel,
		hiddenList,
		hiddenReason,
		moreCount,
		norm,
		popoverCaption,
		symbolText,
		symbolTone
	} from '#lib/matrix.js';
	import { formatDay, formatShort } from '#lib/time.js';
	import type { MatrixVisibility } from '#lib/types.js';

	const CHIPS = 3;

	let { data } = $props();
	const course = $derived(data.course);
	const matrix = $derived(data.matrix);

	// Hiding is stored on the server; the page keeps a local copy so toggles are instant (rolled back on failure).
	let hideGraded = $state(true);
	let overrides = $state<Record<string, MatrixVisibility>>({});
	$effect.pre(() => {
		hideGraded = data.matrix.hideGraded;
		overrides = Object.fromEntries(data.matrix.exercises.map((e) => [e.id, e.visibility]));
	});
	const exercises = $derived(matrix.exercises.map((e) => ({ ...e, visibility: overrides[e.id] ?? null })));
	const hidden = $derived(hiddenList(exercises, hideGraded));
	const shownCols = $derived(
		exercises.map((e, j) => ({ ex: e, j })).filter(({ ex }) => hiddenReason(ex, hideGraded) === null)
	);
	const more = $derived(moreCount(hidden.length, CHIPS));

	let moreOpen = $state(false);
	let moreQuery = $state('');
	const moreRows = $derived(hidden.filter(({ ex }) => norm(ex.title).includes(norm(moreQuery.trim()))));

	async function setVisibility(id: string, visibility: MatrixVisibility) {
		const before = overrides[id] ?? null;
		overrides[id] = visibility;
		try {
			await api(`/teacher/courses/${course.id}/exercises/${encodeURIComponent(id)}/visibility`, { method: 'PUT', body: { visibility } });
		} catch (err) {
			overrides[id] = before;
			error = messageOf(err);
		}
	}
	async function showAll() {
		error = null;
		moreOpen = false;
		await Promise.all(hidden.map(({ ex }) => setVisibility(ex.id, 'shown')));
	}
	async function toggleHideGraded() {
		const before = hideGraded;
		hideGraded = !before;
		error = null;
		try {
			await api(`/teacher/courses/${course.id}/matrix-settings`, { method: 'PUT', body: { hideGraded: !before } });
		} catch (err) {
			hideGraded = before;
			error = messageOf(err);
		}
	}
	const focusOnMount = (node: HTMLElement) => node.focus();

	let query = $state('');
	let onlyMissing = $state(false);
	let zipOpen = $state(false);
	let zipBusy = $state<string | null>(null);
	let error = $state<string | null>(null);

	const rows = $derived(
		matrix.rows
			.map((r, i) => ({ row: r, name: matrix.students[i]?.name ?? '' }))
			.filter(
				({ row, name }) =>
					norm(name).includes(norm(query.trim())) && (!onlyMissing || shownCols.some(({ j }) => row.cells[j] === null))
			)
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
<svelte:window onkeydown={(e) => e.key === 'Escape' && ((zipOpen = false), (moreOpen = false))} />

<PageHeader title="Abgaben" crumb={courseLabel(course)}>
	{#snippet actions()}
		<div class="zip">
			<Button loading={zipBusy !== null} disabled={shownCols.length === 0} onclick={() => (zipOpen = !zipOpen)}>
				⤓ Alle Abgaben einer Aufgabe (ZIP)
			</Button>
			{#if zipOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
				<div class="backdrop" onclick={() => (zipOpen = false)}></div>
				<ul class="menu" aria-label="Aufgabe wählen">
					{#each shownCols as { ex } (ex.id)}
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
		<Button pressed={hideGraded} onclick={toggleHideGraded}>{hideGraded ? '✓ ' : ''}Beurteilte ausblenden</Button>
		<span class="spacer"></span>
		{#if hidden.length === 0}{@render legend()}{/if}
	</div>

	{#if error}<p class="alert" role="alert">{error}</p>{/if}

	{#if hidden.length > 0}
		<div class="hbar">
			<span class="hcount">{hidden.length} ausgeblendet:</span>
			{#each hidden.slice(0, CHIPS) as { ex, reason } (ex.id)}
				<span class="hchip">
					{chipLabel(ex.title, reason)}
					<button class="einblenden" onclick={() => setVisibility(ex.id, 'shown')}>Einblenden</button>
				</span>
			{/each}
			{#if more > 0}
				<button class="more" aria-expanded={moreOpen} aria-haspopup="dialog" onclick={() => ((moreOpen = !moreOpen), (moreQuery = ''))}>
					+{more} weitere {moreOpen ? '▴' : '▾'}
				</button>
				{#if moreOpen}
					<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
					<div class="backdrop" onclick={() => (moreOpen = false)}></div>
					<div class="popover" role="dialog" aria-label="Ausgeblendete Aufgaben">
						<input
							class="psearch"
							type="search"
							bind:value={moreQuery}
							placeholder="⌕  Aufgabe suchen …"
							aria-label="Aufgabe suchen"
							use:focusOnMount
						/>
						<span class="pcap">{popoverCaption(hidden.length)}</span>
						<ul class="plist">
							{#each moreRows as { ex, reason } (ex.id)}
								<li>
									<span class="pt">{ex.title}</span>
									<span class="pr">{reason}</span>
									<button class="einblenden" onclick={() => setVisibility(ex.id, 'shown')}>Einblenden</button>
								</li>
							{:else}
								<li class="muted">Keine Treffer.</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/if}
			<span class="spacer"></span>
			<button class="linkbtn" onclick={showAll}>Alle einblenden</button>
		</div>
	{/if}

	{#if matrix.exercises.length === 0}
		<div class="panel card-pad">
			<span class="card-title">Noch keine Aufgabe freigeschaltet</span>
			<span class="muted">Schalte unter <a href="/kurse/{course.id}/aufgaben">Aufgaben</a> mindestens eine Aufgabe frei, dann erscheinen hier die Abgaben.</span>
		</div>
	{:else if shownCols.length === 0}
		<div class="panel card-pad">
			<span class="card-title">Alle Aufgaben sind ausgeblendet</span>
			<span class="muted">Hol sie oben in der Leiste mit „Einblenden“ zurück.</span>
		</div>
	{:else}
		<div class="panel table">
			<table class="data">
				<thead>
					<tr>
						<th class="name">Schüler:in</th>
						{#each shownCols as { ex, j } (ex.id)}
							<th class="ex">
								<div class="ex-head">
									<b>{ex.title}</b>
									<span>{ex.deadline ? `Frist ${formatDay(ex.deadline)} · ` : ''}{handedIn[j]}/{matrix.students.length}{ex.gradedCount > 0 ? ` · 🔒 ${ex.gradedCount}` : ''}</span>
									<button class="linkbtn small-link" onclick={() => setVisibility(ex.id, 'hidden')}>ausblenden</button>
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as { row, name } (row.studentId)}
						<tr>
							<td class="stud">{name}</td>
							{#each shownCols as { ex, j } (ex.id)}
								{@const c = row.cells[j] ?? null}
								<td>
									{#if c}
										<a
											class="cell {cellTone(c)}"
											href="/kurse/{course.id}/abgaben/{c.handinId}"
											title={c.count > 1 ? `${c.count} Abgaben, die letzte zählt` : undefined}
										>
											<span class="top">
												<span>{cellLabel(c)}</span>
												{#if c.grade}
													<span class="pill" title="beurteilt – Abgabe gesperrt">🔒 <b class={symbolTone(c.grade.symbol)}>{symbolText(c.grade.symbol)}</b></span>
												{/if}
											</span>
											<span class="ts">{formatShort(c.submittedAt)}</span>
										</a>
									{:else}
										<div class="cell none"><span class="top">–</span><span class="ts">keine Abgabe</span></div>
									{/if}
								</td>
							{/each}
						</tr>
					{:else}
						<tr><td colspan={shownCols.length + 1} class="muted empty">
							{matrix.students.length === 0 ? 'Noch keine Schüler:innen in diesem Kurs.' : 'Keine Treffer.'}
						</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<span class="small"
		>Klick auf eine Zelle öffnet die Abgabe. „Beurteilte ausblenden“ blendet jede Aufgabe aus, in der schon eine Abgabe beurteilt ist; „Einblenden“ holt sie zurück. Gilt auch für den ZIP-Download.</span
	>
	{#if hidden.length > 0}{@render legend()}{/if}
</div>

{#snippet legend()}
	<div class="legend">
		<span><span class="sw" style="background: var(--success-soft)"></span>alle Tests bestanden</span>
		<span><span class="sw" style="background: var(--warn-soft)"></span>Tests teilweise</span>
		<span><span class="sw" style="background: var(--danger-soft)"></span>verspätet</span>
		<span><span class="sw" style="background: var(--surface-alt)"></span>keine Abgabe</span>
		<span>🔒 beurteilt – Abgabe gesperrt</span>
	</div>
{/snippet}

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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
	}
	.pill {
		padding: 0 6px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		font-size: 11px;
		font-weight: 500;
		line-height: 18px;
		white-space: nowrap;
	}
	.pill b {
		font-weight: 700;
	}
	.pill .good {
		color: var(--success);
	}
	.pill .mid {
		color: var(--warn);
	}
	.pill .bad {
		color: var(--danger);
	}
	.linkbtn {
		padding: 0;
		border: 0;
		background: none;
		color: var(--primary);
		font-size: 12px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}
	.linkbtn:hover {
		text-decoration: underline;
	}
	.hbar {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border: 1.5px dashed var(--border-strong);
		border-radius: var(--radius-lg);
		font-size: 12px;
		white-space: nowrap;
	}
	.hcount {
		color: var(--text-muted);
	}
	.hchip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		padding: 3px 4px 3px 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.einblenden {
		padding: 1px 9px;
		border: 1px solid var(--primary-line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--primary);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}
	.einblenden:hover {
		background: var(--primary-soft);
	}
	.more {
		padding: 0;
		border: 0;
		background: none;
		color: var(--primary);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.popover {
		position: absolute;
		z-index: 11;
		right: 0;
		top: calc(100% + 6px);
		width: 270px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}
	.psearch {
		height: 32px;
		padding: 0 10px;
		border: 1.5px solid var(--border-strong);
		border-radius: 8px;
	}
	.pcap {
		font-size: 11px;
		color: var(--text-faint);
	}
	.plist {
		display: flex;
		flex-direction: column;
		max-height: 260px;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}
	.plist li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 0;
		border-top: 1px solid var(--border);
		font-size: 12px;
	}
	.pt {
		font-weight: 500;
	}
	.pr {
		flex: 1;
		color: var(--text-faint);
	}
	.small-link {
		font-size: 11px;
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
