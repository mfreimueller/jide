<script lang="ts">
	import { api } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { courseLabel } from '#lib/course.svelte.js';
	import { messageOf } from '#lib/errors.js';
	import { checkNewHost } from '#lib/practice_hosts.js';
	import type { PracticeHostsResponse } from '@jide/shared';

	let { data } = $props();
	const course = $derived(data.course);

	// The list the server confirmed last; a failed save leaves it untouched.
	let hosts = $state<string[]>([]);
	$effect(() => {
		hosts = data.hosts;
	});
	let text = $state('');
	let hint = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let saving = $state(false);

	async function save(next: string[]): Promise<boolean> {
		saving = true;
		saveError = null;
		try {
			const res = await api<PracticeHostsResponse>(`/teacher/courses/${course.id}/practice-hosts`, { method: 'PUT', body: { hosts: next } });
			hosts = res.hosts;
			return true;
		} catch (err) {
			saveError = messageOf(err);
			return false;
		} finally {
			saving = false;
		}
	}

	async function add(e: Event) {
		e.preventDefault();
		if (saving) return;
		saveError = null;
		const check = checkNewHost(text, hosts);
		if (!check.ok) {
			hint = check.error;
			return;
		}
		hint = null;
		if (await save([...hosts, check.host])) text = '';
	}

	function remove(host: string) {
		hint = null;
		return save(hosts.filter((h) => h !== host));
	}
</script>

<svelte:head><title>Einstellungen · {courseLabel(course)} · J;DE Lehrkraft</title></svelte:head>

<PageHeader title="Einstellungen" crumb={courseLabel(course)} />

<div class="body">
	<section class="panel card-pad">
		<h2 class="card-title">Übungs-Links</h2>
		<p class="muted">
			J;DE öffnet Übungs-Links (jide://practice) nur, wenn die ZIP-Datei von einem dieser Hosts kommt. Schüler:innen müssen dafür in J;DE angemeldet sein.
		</p>

		{#if hosts.length === 0}
			<p class="muted empty">Noch keine Hosts – Übungs-Links funktionieren für diesen Kurs nicht.</p>
		{:else}
			<ul class="hosts" aria-label="Erlaubte Hosts">
				{#each hosts as host (host)}
					<li>
						<code>{host}</code>
						<Button size="sm" disabled={saving} onclick={() => remove(host)}>Entfernen</Button>
					</li>
				{/each}
			</ul>
		{/if}

		<form class="add" onsubmit={add}>
			<div class="field">
				<label for="host-input">Host hinzufügen</label>
				<div class="row">
					<input
						id="host-input"
						type="text"
						autocomplete="off"
						placeholder="z. B. die-spengergasse.github.io"
						bind:value={text}
						oninput={() => (hint = null)}
						aria-invalid={hint ? 'true' : undefined}
						aria-describedby={hint ? 'host-hint' : undefined}
					/>
					<Button type="submit" variant="primary" disabled={saving}>Hinzufügen</Button>
				</div>
				{#if hint}<p class="error" id="host-hint" role="alert">{hint}</p>{/if}
			</div>
		</form>

		{#if saveError}<p class="alert" role="alert">{saveError}</p>{/if}
	</section>
</div>

<style>
	.card-pad {
		gap: 14px;
		max-width: 640px;
	}
	.empty {
		padding: 4px 0;
	}
	.hosts {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.hosts li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 12px;
	}
	.hosts li + li {
		border-top: 1px solid var(--border);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-size: 13px;
		font-weight: 500;
	}
	.row {
		display: flex;
		gap: 10px;
	}
	input {
		flex: 1;
		min-width: 0;
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
</style>
