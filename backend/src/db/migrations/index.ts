import { MIGRATION_0001_TEACHERS_AND_AUTH } from './0001_teachers_and_auth.js';
import { MIGRATION_0002_COURSES_AND_STUDENTS } from './0002_courses_and_students.js';
import { MIGRATION_0003_EXERCISES } from './0003_exercises.js';
import { MIGRATION_0004_HANDINS } from './0004_handins.js';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  MIGRATION_0001_TEACHERS_AND_AUTH,
  MIGRATION_0002_COURSES_AND_STUDENTS,
  MIGRATION_0003_EXERCISES,
  MIGRATION_0004_HANDINS,
];
