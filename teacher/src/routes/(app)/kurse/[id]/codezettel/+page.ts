import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { Course, Student } from '#lib/types.js';

export async function load({ params }) {
	try {
		const [course, students] = await Promise.all([
			api<{ course: Course }>(`/teacher/courses/${params.id}`),
			api<{ students: Student[] }>(`/teacher/courses/${params.id}/students`)
		]);
		return { course: course.course, students: students.students };
	} catch (err) {
		failLoad(err);
	}
}
