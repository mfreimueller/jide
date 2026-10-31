<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.js';
	import { auth } from '#lib/auth.svelte.js';
	import { courseLabel, courseStore } from '#lib/course.svelte.js';
	import { lastCourseId } from '#lib/last_course.js';
	import Logo from '#lib/components/Logo.svelte';

	let { children } = $props();

	const paramId = $derived(page.params.id ? Number(page.params.id) : null);
	const course = $derived(
		courseStore.courses.find((c) => c.id === (paramId ?? lastCourseId.get())) ?? (paramId ? null : (courseStore.active[0] ?? null))
	);
	const section = $derived(page.url.pathname.split('/')[3] ?? 'abgaben');
	let menuOpen = $state(false);

	$effect(() => {
		if (paramId) lastCourseId.set(paramId);
	});

	// The exercise count in the sidebar belongs to the current course.
	$effect(() => {
		const id = course?.id;
		courseStore.exerciseCount = null;
		if (!id) return;
		api<{ exercises: unknown[] }>(`/teacher/courses/${id}/exercises`)
			.then((r) => {
				if (course?.id === id) courseStore.exerciseCount = r.exercises.length;
			})
			.catch(() => {});
	});

	function pick(id: number) {
		menuOpen = false;
		return goto(`/kurse/${id}/${['abgaben', 'schueler', 'aufgaben'].includes(section) ? section : 'abgaben'}`);
	}

	async function signOut() {
		try {
			await api('/teacher/auth/logout', { method: 'POST', body: {} });
		} catch {
			// Signing out locally is enough if the server cannot be reached.
		}
		auth.clear();
		await goto('/login');
	}

	const items = $derived([
		{ key: 'abgaben', icon: '▦', label: 'Abgaben', count: null as number | null },
		{ key: 'schueler', icon: '☺', label: 'Schüler:innen', count: course?.studentCount ?? null },
		{ key: 'aufgaben', icon: '≡', label: 'Aufgaben', count: courseStore.exerciseCount }
	]);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} />

<div class="app">
	<aside>
		<div class="brand"><Logo /></div>

		<div class="switcher">
			<button class="course" aria-haspopup="listbox" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
				<span class="meta">
					<span class="small">Kurs</span>
					<span class="name">{course ? courseLabel(course) : 'Kein Kurs gewählt'}</span>
				</span>
				<span class="small" aria-hidden="true">▾</span>
			</button>
			{#if menuOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
				<div class="backdrop" onclick={() => (menuOpen = false)}></div>
				<ul class="menu" role="listbox" aria-label="Kurs wählen">
					{#each courseStore.active as c (c.id)}
						<li role="option" aria-selected={c.id === course?.id}>
							<button class:current={c.id === course?.id} onclick={() => pick(c.id)}>{courseLabel(c)}</button>
						</li>
					{:else}
						<li class="empty small">Noch kein Kurs vorhanden.</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if course}
			{#each items as it (it.key)}
				<a class="nav" class:active={section === it.key && !!paramId} href="/kurse/{course.id}/{it.key}">
					<span class="ico" aria-hidden="true">{it.icon}</span>{it.label}
					{#if it.count !== null}<span class="count">{it.count}</span>{/if}
				</a>
			{/each}
		{/if}

		<div class="foot">
			<a class="nav" class:active={page.url.pathname === '/kurse'} href="/kurse"><span class="ico" aria-hidden="true">⚙</span>Kurse verwalten</a>
			<button class="nav" onclick={signOut}><span class="ico" aria-hidden="true">↩</span>Abmelden</button>
		</div>
	</aside>
	<main>{@render children()}</main>
</div>

<style>
	.app {
		display: grid;
		grid-template-columns: 248px minmax(0, 1fr);
		min-height: 100vh;
	}
	aside {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 18px 14px;
		background: var(--surface);
		border-right: 1px solid var(--border);
		position: sticky;
		top: 0;
		height: 100vh;
	}
	.brand {
		padding: 0 6px 14px;
	}
	.switcher {
		position: relative;
		margin-bottom: 14px;
	}
	.course {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		text-align: left;
		cursor: pointer;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}
	.name {
		font-size: 14px;
		font-weight: 600;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
	}
	.menu {
		position: absolute;
		z-index: 11;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
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
	.menu button.current {
		color: var(--primary);
		font-weight: 600;
	}
	.empty {
		padding: 8px 10px;
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 9px 12px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--text-body);
		font-size: 14px;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.nav:hover {
		background: var(--surface-alt);
	}
	.nav.active {
		background: var(--primary-soft);
		color: var(--primary);
		font-weight: 600;
	}
	.ico {
		width: 18px;
		text-align: center;
		font-size: 14px;
	}
	.count {
		margin-left: auto;
		font-size: 12px;
		font-weight: 400;
		color: var(--text-faint);
	}
	.active .count {
		color: var(--primary);
	}
	.foot {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: auto;
		padding-top: 10px;
		border-top: 1px solid var(--border);
	}
	main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 100vh;
	}
</style>
