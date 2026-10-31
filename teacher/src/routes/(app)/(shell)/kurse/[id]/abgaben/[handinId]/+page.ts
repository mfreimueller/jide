import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { HandInDetail, Matrix } from '#lib/types.js';

export async function load({ params }) {
	try {
		const [detail, matrix] = await Promise.all([
			api<{ handin: HandInDetail }>(`/teacher/handins/${params.handinId}`),
			api<Matrix>(`/teacher/courses/${params.id}/handins`)
		]);
		// previous/next only carry ids; the names come from the matrix of the course.
		const names = new Map(matrix.students.map((s) => [s.id, s.name]));
		return { handin: detail.handin, names: Object.fromEntries(names) as Record<number, string> };
	} catch (err) {
		failLoad(err);
	}
}
