import { redirect } from '@sveltejs/kit';
import { courseStore } from '#lib/course.svelte.js';
import { lastCourseId } from '#lib/last_course.js';

export async function load() {
	await courseStore.refresh();
	const active = courseStore.active;
	const last = lastCourseId.get();
	const target = active.find((c) => c.id === last) ?? active[0];
	redirect(307, target ? `/kurse/${target.id}/abgaben` : '/kurse');
}
