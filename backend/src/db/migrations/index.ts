import { MIGRATION_0001_TEACHERS_AND_AUTH } from './0001_teachers_and_auth.js';
import { MIGRATION_0002_COURSES_AND_STUDENTS } from './0002_courses_and_students.js';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [MIGRATION_0001_TEACHERS_AND_AUTH, MIGRATION_0002_COURSES_AND_STUDENTS];
