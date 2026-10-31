const KEY = 'jide.teacher.course';

/** Remembers the course the teacher worked in last, so "/" can open it. */
export const lastCourseId = {
	get(): number | null {
		try {
			const n = Number(localStorage.getItem(KEY));
			return Number.isInteger(n) && n > 0 ? n : null;
		} catch {
			return null;
		}
	},
	set(id: number): void {
		try {
			localStorage.setItem(KEY, String(id));
		} catch {
			// not persisted
		}
	}
};
