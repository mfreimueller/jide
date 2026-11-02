import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { CourseExercise, ExerciseGroup, Matrix } from '#lib/types.js';

export async function load({ params, depends }) {
	depends('app:exercises');
	try {
		const [exercises, matrix] = await Promise.all([
			api<{ exercises: CourseExercise[]; groups: ExerciseGroup[] }>(`/teacher/courses/${params.id}/exercises`),
			api<Matrix>(`/teacher/courses/${params.id}/handins`)
		]);
		// "x / y": students with at least one hand-in out of all students, for unlocked exercises only.
		const handIns: Record<string, string> = {};
		matrix.exercises.forEach((ex, j) => {
			const done = matrix.rows.filter((r) => r.cells[j] !== null).length;
			handIns[ex.id] = `${done} / ${matrix.students.length}`;
		});
		return { exercises: exercises.exercises, groups: exercises.groups, handIns };
	} catch (err) {
		failLoad(err);
	}
}
