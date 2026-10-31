import { courseStore } from '#lib/course.svelte.js';

export async function load() {
	if (!courseStore.loaded) await courseStore.refresh();
}
