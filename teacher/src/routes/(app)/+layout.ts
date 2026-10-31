import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/auth.svelte.js';

export function load() {
	if (!auth.signedIn) redirect(307, '/login');
}
