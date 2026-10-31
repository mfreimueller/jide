import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { Course } from '#lib/types.js';

export async function load({ params }) {
	try {
		const res = await api<{ course: Course }>(`/teacher/courses/${params.id}`);
		return { course: res.course };
	} catch (err) {
		failLoad(err);
	}
}
