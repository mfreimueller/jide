<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { api } from '#lib/api.js';
	import Button from '#lib/components/Button.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import TextField from '#lib/components/TextField.svelte';
	import { messageOf } from '#lib/errors.js';
	import { formatRelative } from '#lib/time.js';
	import type { ApiKey } from '#lib/types.js';

	let { data } = $props();
	const keys = $derived(data.apiKeys);

	let name = $state('');
	let creating = $state(false);
	let error = $state<string | null>(null);
	/** The full key of the key created last. Only kept in memory; gone after a reload. */
	let created = $state<string | null>(null);
	let copied = $state(false);

	let revokeTarget = $state<ApiKey | null>(null);
	let revokeOpen = $state(false);
	let revoking = $state(false);
	let revokeError = $state<string | null>(null);

	async function create(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		creating = true;
		try {
			const res = await api<{ apiKey: ApiKey; key: string }>('/teacher/api-keys', { method: 'POST', body: { name } });
			created = res.key;
			copied = false;
			name = '';
			await invalidate('app:api-keys');
		} catch (err) {
			error = messageOf(err);
		} finally {
			creating = false;
		}
	}

	async function copy() {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created);
			copied = true;
		} catch {
			error = 'Kopieren hat nicht geklappt. Markiere den Schlüssel und kopiere ihn von Hand.';
		}
	}

	function askRevoke(k: ApiKey) {
		revokeTarget = k;
		revokeError = null;
		revokeOpen = true;
	}

	async function revoke() {
		if (!revokeTarget) return;
		revoking = true;
		revokeError = null;
		try {
			await api(`/teacher/api-keys/${revokeTarget.id}`, { method: 'DELETE' });
			revokeOpen = false;
			await invalidate('app:api-keys');
		} catch (err) {
			revokeError = messageOf(err);
		} finally {
			revoking = false;
		}
	}
</script>

<svelte:head><title>API-Schlüssel · J;DE Lehrkraft</title></svelte:head>

<PageHeader title="API-Schlüssel" crumb="Konto" />

<div class="body">
	<div class="split">
		<div class="panel table">
			<table class="data">
				<thead>
					<tr><th>Name</th><th>Schlüssel</th><th>Zuletzt benutzt</th><th>Erstellt</th><th></th></tr>
				</thead>
				<tbody>
					{#each keys as k (k.id)}
						<tr>
							<td class="nm">{k.name}</td>
							<td><span class="code-pill">{k.prefix}…</span></td>
							<td>
								<span class="dot" class:never={k.lastUsedAt === null}></span>{k.lastUsedAt === null ? 'noch nie benutzt' : formatRelative(k.lastUsedAt)}
							</td>
							<td>{formatRelative(k.createdAt)}</td>
							<td class="right"><button class="revoke" onclick={() => askRevoke(k)}>Widerrufen …</button></td>
						</tr>
					{:else}
						<tr><td colspan="5" class="muted empty">Noch kein API-Schlüssel. Erzeuge rechts den ersten.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="infocol">
			<form class="panel card-pad" onsubmit={create}>
				<span class="card-title">Neuer API-Schlüssel</span>
				<span class="muted">
					Für Grader: Gradeflow liest damit die Abgaben und trägt die Beurteilungen ein. Der Name hilft dir, Schlüssel auseinanderzuhalten.
				</span>
				<TextField label="Name" bind:value={name} max={100} placeholder="z. B. Grader am Schul-Laptop" />
				{#if error}<p class="alert" role="alert">{error}</p>{/if}
				<Button variant="primary" type="submit" loading={creating} disabled={name.trim() === ''}>Schlüssel erzeugen</Button>
			</form>

			{#if created}
				<div class="panel card-pad created" role="status">
					<span class="card-title">Schlüssel erzeugt – nur jetzt sichtbar</span>
					<span class="muted">Kopiere ihn jetzt in Grader (Einstellungen → J;DE). Danach zeigt jide nur noch den Anfang.</span>
					<code class="full" data-testid="new-key">{created}</code>
					<Button variant="primary" onclick={copy}>{copied ? 'Kopiert' : 'Kopieren'}</Button>
				</div>
			{/if}

			<div class="panel card-pad">
				<span class="card-title">Hinweis</span>
				<span class="muted">
					Mit einem Schlüssel kann Grader alle deine Kurse, Aufgaben und Abgaben lesen und Beurteilungen eintragen. Gib ihn nicht weiter. „Widerrufen“
					macht ihn sofort ungültig.
				</span>
			</div>
		</div>
	</div>
</div>

<Dialog bind:open={revokeOpen} title="Schlüssel „{revokeTarget?.name}“ widerrufen?" width={460}>
	<p class="muted">
		Der Schlüssel <span class="code-pill">{revokeTarget?.prefix}…</span> funktioniert sofort nicht mehr. Grader muss dann einen neuen Schlüssel bekommen.
		Bereits eingetragene Beurteilungen bleiben erhalten.
	</p>
	{#if revokeError}<p class="alert" role="alert">{revokeError}</p>{/if}
	<div class="dialog-actions">
		<Button onclick={() => (revokeOpen = false)}>Abbrechen</Button>
		<Button variant="danger" loading={revoking} onclick={revoke}>Widerrufen</Button>
	</div>
</Dialog>

<style>
	.table {
		flex: 1;
		overflow: hidden;
	}
	.nm {
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
		background: var(--text-faint);
	}
	.revoke {
		border: 0;
		background: none;
		color: var(--danger);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}
	.revoke:hover {
		text-decoration: underline;
	}
	form {
		display: flex;
		flex-direction: column;
	}
	.created {
		border-color: var(--success-line);
		background: var(--success-wash);
	}
	.full {
		display: block;
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 13px;
		word-break: break-all;
		user-select: all;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
</style>
