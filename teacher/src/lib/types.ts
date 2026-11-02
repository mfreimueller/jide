// Response shapes of the teacher API (backend/README.md). Student-facing shapes live in @jide/shared.
import type { HandInFile, TestSummary } from '@jide/shared';

export type { HandInFile, TestSummary };

export interface Teacher {
	id: number;
	email: string;
	displayName: string;
}

export interface Course {
	id: number;
	subject: string;
	className: string;
	archived: boolean;
	createdAt: string;
	studentCount: number;
}

export interface Student {
	id: number;
	name: string;
	/** Formatted XXXX-XXXX */
	code: string;
	/** null = never signed in */
	lastActivityAt: string | null;
	handInCount: number;
	unlockedExerciseCount: number;
}

export interface Exercise {
	id: string;
	title: string;
	version: string;
	uploadedAt: string;
	size: number;
}

export interface CourseExercise extends Exercise {
	unlocked: boolean;
	/** ISO instant (UTC) or null */
	deadline: string | null;
	/** Group of this course or null */
	groupId: number | null;
	/** Place inside the group, null when ungrouped */
	position: number | null;
}

export interface ExerciseGroup {
	id: number;
	name: string;
}

export interface MatrixCell {
	handinId: number;
	submittedAt: string;
	late: boolean;
	testSummary: TestSummary | null;
	count: number;
}

export interface Matrix {
	students: { id: number; name: string }[];
	exercises: { id: string; title: string; deadline: string | null }[];
	rows: { studentId: number; cells: (MatrixCell | null)[] }[];
}

export interface HandInDetail {
	id: number;
	student: { id: number; name: string };
	exercise: { id: string; title: string; deadline: string | null };
	submittedAt: string;
	late: boolean;
	exerciseVersion: string;
	testSummary: TestSummary | null;
	files: HandInFile[];
	/** Newest first. */
	history: { id: number; submittedAt: string; late: boolean; testSummary?: TestSummary | null }[];
	previous: { studentId: number; handinId: number } | null;
	next: { studentId: number; handinId: number } | null;
}
