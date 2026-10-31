import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { Matrix } from '#lib/types.js';

export async function load({ params }) {
	try {
		return { matrix: await api<Matrix>(`/teacher/courses/${params.id}/handins`) };
	} catch (err) {
		failLoad(err);
	}
}
