<script lang="ts">
	import Button from '#lib/components/Button.svelte';

	let { data } = $props();
	const course = $derived(data.course);
	const students = $derived(data.students);
</script>

<svelte:head><title>Codezettel · {course.subject} {course.className} · J;DE Lehrkraft</title></svelte:head>

<div class="screen">
	<div class="bar">
		<Button variant="ghost" href="/kurse/{course.id}/schueler">← Schüler:innen</Button>
		<strong>Codezettel · {course.subject} {course.className}</strong>
		<span class="small">{students.length} Zettel · zum Ausschneiden</span>
		<span class="spacer"></span>
		<Button variant="primary" onclick={() => window.print()}>⎙ Drucken</Button>
	</div>
	<div class="paper-wrap">
		<div class="paper">
			{#each students as s (s.id)}
				<div class="slip">
					<span class="who">{s.name} · {course.className}</span>
					<span class="c">{s.code}</span>
					<span class="hint">Öffne J;DE und gib diesen Code ein. Gut aufheben – nicht weitergeben!</span>
				</div>
			{:else}
				<p class="muted none">Noch keine Schüler:innen in diesem Kurs.</p>
			{/each}
		</div>
	</div>
</div>

<style>
	.screen {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 56px;
		padding: 0 24px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.paper-wrap {
		flex: 1;
		display: flex;
		justify-content: center;
		padding: 30px;
		background: #e9ecef;
	}
	.paper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-content: start;
		width: 595px;
		padding: 34px;
		background: #fff;
		box-shadow: 0 4px 18px rgb(0 0 0 / 0.12);
	}
	.slip {
		display: flex;
		flex-direction: column;
		gap: 6px;
		height: 128px;
		margin: -0.5px;
		padding: 14px 16px;
		border: 1px dashed var(--text-ghost);
		break-inside: avoid;
	}
	.who {
		font-size: 13px;
		font-weight: 600;
	}
	.c {
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.hint {
		font-size: 10px;
		line-height: 14px;
		color: var(--text-muted);
	}
	.none {
		grid-column: 1 / -1;
	}

	@media print {
		@page {
			size: A4;
			margin: 12mm;
		}
		.bar {
			display: none;
		}
		.paper-wrap {
			display: block;
			padding: 0;
			background: #fff;
		}
		.paper {
			width: auto;
			padding: 0;
			box-shadow: none;
		}
		.slip {
			height: 45mm;
			padding: 5mm 6mm;
			gap: 2mm;
		}
		.who {
			font-size: 11pt;
		}
		.c {
			font-size: 20pt;
		}
		.hint {
			font-size: 8pt;
			line-height: 1.3;
		}
	}
</style>
