<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { highlightJava } from '#lib/highlight.js';
	import { formatDateTime } from '#lib/time.js';

	let { data } = $props();
	const course = $derived(data.course);
	const h = $derived(data.handin);

	// Selected file tab; reset when another hand-in is opened.
	let picked = $state<{ id: number; index: number }>({ id: -1, index: 0 });
	const index = $derived(picked.id === h.id ? Math.min(picked.index, h.files.length - 1) : 0);
	const file = $derived(h.files[index]);
	// A trailing newline would show as an empty last line.
	const source = $derived(file ? file.content.replace(/\n$/, '') : '');
	const lineCount = $derived(source.split('\n').length);
	const html = $derived(highlightJava(source));

	const tests = $derived(h.testSummary);
	const toneClass = $derived(!tests || tests.total === 0 ? '' : tests.passed >= tests.total ? 'good' : 'partial');
	const nameOf = (id: number) => data.names[id] ?? 'Nächste Person';
</script>

<svelte:head><title>{h.student.name} · {h.exercise.title} · J;DE Lehrkraft</title></svelte:head>

<PageHeader title={h.student.name} crumb="Abgaben › {h.exercise.title}" crumbHref="/kurse/{course.id}/abgaben">
	{#snippet badge()}
		{#if h.late}<span class="chip late">verspätet</span>{/if}
	{/snippet}
	{#snippet actions()}
		{#if h.previous}
			<Button href="/kurse/{course.id}/abgaben/{h.previous.handinId}">← {nameOf(h.previous.studentId)}</Button>
		{/if}
		{#if h.next}
			<Button href="/kurse/{course.id}/abgaben/{h.next.handinId}">{nameOf(h.next.studentId)} →</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="body">
	<div class="split">
		<div class="panel codeview">
			<div class="ftabs" role="tablist">
				{#each h.files as f, i (f.path)}
					<button role="tab" aria-selected={i === index} class="ftab" class:active={i === index} onclick={() => (picked = { id: h.id, index: i })}>
						{f.path}
					</button>
				{/each}
			</div>
			{#if file}
				<div class="code-area" role="tabpanel">
					<div class="gutter" aria-hidden="true">{#each { length: lineCount } as _, n}{n + 1}<br />{/each}</div>
					<pre class="code"><code>{@html html}</code></pre>
				</div>
			{:else}
				<p class="muted pad">Diese Abgabe enthält keine Dateien.</p>
			{/if}
		</div>

		<div class="infocol">
			<div class="panel card-pad">
				<span class="card-title">Abgabe</span>
				<div class="kv"><span>Abgegeben</span><span>{formatDateTime(h.submittedAt)}</span></div>
				<div class="kv"><span>Frist</span><span>{formatDateTime(h.exercise.deadline)}</span></div>
				<div class="kv">
					<span>Tests (lokal)</span>
					{#if tests}<span class="tests {toneClass}">{tests.passed} von {tests.total}</span>{:else}<span>–</span>{/if}
				</div>
			</div>
			<div class="panel card-pad">
				<span class="card-title">Testergebnisse</span>
				{#if tests}
					<div class="trow">
						<span class={tests.passed >= tests.total ? 'pass' : 'fail'}>{tests.passed >= tests.total ? '✓' : '✗'}</span>
						{tests.passed} von {tests.total} Tests bestanden
					</div>
				{:else}
					<span class="muted">Es wurden keine Testergebnisse übermittelt.</span>
				{/if}
				<span class="small">Ergebnis vom Laptop der Schülerin – nur ein Hinweis.</span>
			</div>
			<div class="panel card-pad">
				<span class="card-title">Verlauf ({h.history.length} {h.history.length === 1 ? 'Abgabe' : 'Abgaben'})</span>
				{#each h.history as item, i (item.id)}
					<a class="hist" class:cur={item.id === h.id} href="/kurse/{course.id}/abgaben/{item.id}">
						<span>{formatDateTime(item.submittedAt)}</span>
						<span>{#if item.late}verspätet{/if}{#if item.late && i === 0} · {/if}{#if i === 0}zählt{/if}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.codeview {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}
	.ftabs {
		display: flex;
		gap: 2px;
		padding: 8px 8px 0;
		background: var(--surface-alt);
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
	}
	.ftab {
		padding: 7px 14px;
		border: 0;
		border-radius: 6px 6px 0 0;
		background: none;
		color: var(--text-muted);
		font-size: 13px;
		cursor: pointer;
		white-space: nowrap;
	}
	.ftab.active {
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
	}
	.code-area {
		display: flex;
		padding: 12px 0;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 13.5px;
		line-height: 22px;
	}
	.gutter {
		flex: none;
		width: 50px;
		padding-right: 14px;
		text-align: right;
		color: var(--text-ghost);
		user-select: none;
	}
	.code {
		margin: 0;
		font: inherit;
		white-space: pre;
	}
	.code code {
		font: inherit;
	}
	.pad {
		padding: 18px;
	}
	/* highlight.js token colours from the design */
	.code :global(.hljs-keyword),
	.code :global(.hljs-literal) {
		color: #8e4ec6;
	}
	.code :global(.hljs-type),
	.code :global(.hljs-built_in),
	.code :global(.hljs-title.class_),
	.code :global(.hljs-title.class_.inherited__) {
		color: #0d74ce;
	}
	.code :global(.hljs-string) {
		color: var(--success);
	}
	.code :global(.hljs-number) {
		color: var(--warn);
	}
	.code :global(.hljs-comment),
	.code :global(.hljs-doctag) {
		color: var(--text-faint);
		font-style: italic;
	}
	.code :global(.hljs-title.function_) {
		font-weight: 600;
	}
	.code :global(.hljs-meta) {
		color: var(--text-muted);
	}
	.kv {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
	}
	.kv span:first-child {
		color: var(--text-muted);
	}
	.tests.good {
		color: var(--success);
		font-weight: 600;
	}
	.tests.partial {
		color: var(--warn);
		font-weight: 600;
	}
	.trow {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}
	.pass,
	.fail {
		width: 14px;
		font-weight: 700;
	}
	.pass {
		color: var(--success);
	}
	.fail {
		color: var(--danger);
	}
	.hist {
		display: flex;
		justify-content: space-between;
		padding: 6px 8px;
		border-radius: 6px;
		font-size: 13px;
		color: inherit;
		text-decoration: none;
	}
	.hist:hover {
		background: var(--surface-alt);
	}
	.hist.cur {
		background: var(--primary-soft);
		color: var(--primary);
		font-weight: 500;
	}
</style>
