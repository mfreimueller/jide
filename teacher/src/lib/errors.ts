import { error } from '@sveltejs/kit';
import { ApiError } from './api.js';

/** For load functions: turn an API failure into a SvelteKit error page. */
export function failLoad(err: unknown): never {
	if (err instanceof ApiError) error(err.status === 0 ? 503 : err.status, err.message);
	throw err;
}

export const messageOf = (err: unknown): string => (err instanceof Error ? err.message : 'Etwas ist schiefgelaufen.');
