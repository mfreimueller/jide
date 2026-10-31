import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { Student } from '#lib/types.js';

export async function load({ params, depends }) {
	depends('app:students');
	try {
		const res = await api<{ students: Student[] }>(`/teacher/courses/${params.id}/students`);
		return { students: res.students };
	} catch (err) {
		failLoad(err);
	}
}
