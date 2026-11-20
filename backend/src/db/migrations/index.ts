import { MIGRATION_0001_TEACHERS_AND_AUTH } from './0001_teachers_and_auth.js';
import { MIGRATION_0002_COURSES_AND_STUDENTS } from './0002_courses_and_students.js';
import { MIGRATION_0003_EXERCISES } from './0003_exercises.js';
import { MIGRATION_0004_HANDINS } from './0004_handins.js';
import { MIGRATION_0005_STUDENT_ARCHIVE } from './0005_student_archive.js';
import { MIGRATION_0006_EXERCISE_GROUPS } from './0006_exercise_groups.js';
import { MIGRATION_0007_UNLOCKED_AT } from './0007_unlocked_at.js';
import { MIGRATION_0008_DIFFICULTY } from './0008_difficulty.js';
import { MIGRATION_0009_API_KEYS } from './0009_api_keys.js';
import { MIGRATION_0010_GRADES } from './0010_grades.js';

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
  MIGRATION_0005_STUDENT_ARCHIVE,
  MIGRATION_0006_EXERCISE_GROUPS,
  MIGRATION_0007_UNLOCKED_AT,
  MIGRATION_0008_DIFFICULTY,
  MIGRATION_0009_API_KEYS,
  MIGRATION_0010_GRADES,
];
