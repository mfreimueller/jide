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

export interface ApiKey {
	id: number;
	name: string;
	/** Start of the key, e.g. `jide_k7Q2`. The full key is shown once, on creation. */
	prefix: string;
	createdAt: string;
	/** null = never used */
	lastUsedAt: string | null;
}

export interface Exercise {
	id: string;
	title: string;
	version: string;
	uploadedAt: string;
	size: number;
}

export type GradeSymbol = 'PLUS' | 'PLUS_WELLE' | 'WELLE' | 'MINUS_WELLE' | 'MINUS';
/** Manual matrix override: null = automatic. */
export type MatrixVisibility = 'hidden' | 'shown' | null;

export interface CourseExercise extends Exercise {
	unlocked: boolean;
	/** ISO instant (UTC) or null */
	deadline: string | null;
	/** Group of this course or null */
	groupId: number | null;
	/** Students of the course whose hand-in of this exercise is graded. */
	gradedCount: number;
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
	grade: { symbol: GradeSymbol; gradedAt: string } | null;
}

export interface MatrixExercise {
	id: string;
	title: string;
	deadline: string | null;
	gradedCount: number;
	visibility: MatrixVisibility;
	unlockedAt: string | null;
}

export interface Matrix {
	students: { id: number; name: string }[];
	exercises: MatrixExercise[];
	hideGraded: boolean;
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
	history: { id: number; submittedAt: string; late: boolean; graded: boolean; testSummary?: TestSummary | null }[];
	/** Grade of this very hand-in, or null (also for non-graded hand-ins of a graded exercise). */
	grade: {
		symbol: GradeSymbol;
		comment: string;
		gradedAt: string;
		lineComments: { path: string; line: number; text: string }[];
	} | null;
	previous: { studentId: number; handinId: number } | null;
	next: { studentId: number; handinId: number } | null;
}
