import { api } from './api.js';
import type { Course } from './types.js';

/** Courses shown in the sidebar and the number of exercises of the current course. */
class CourseStore {
	courses = $state<Course[]>([]);
	exerciseCount = $state<number | null>(null);
	loaded = $state(false);

	async refresh(): Promise<void> {
		const res = await api<{ courses: Course[] }>('/teacher/courses?archived=1');
		this.courses = res.courses;
		this.loaded = true;
	}

	get active(): Course[] {
		return this.courses.filter((c) => !c.archived);
	}
}

export const courseStore = new CourseStore();

export const courseLabel = (c: { subject: string; className: string }) => `${c.subject} · ${c.className}`;
