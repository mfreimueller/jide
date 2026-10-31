import type { Migration } from './index.js';

export const MIGRATION_0003_EXERCISES: Migration = {
  version: 3,
  name: 'exercises',
  statements: [
    // slug = the id from exercise.yaml, unique per teacher. The package is the normalised zip itself.
    `CREATE TABLE exercises (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      teacher_id  INT UNSIGNED NOT NULL,
      slug        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      title       VARCHAR(255) NOT NULL,
      version     CHAR(64) CHARACTER SET ascii NOT NULL,
      size        INT UNSIGNED NOT NULL,
      package     LONGBLOB NOT NULL,
      uploaded_at DATETIME NOT NULL,
      UNIQUE KEY uq_exercises_teacher_slug (teacher_id, slug),
      CONSTRAINT fk_exercises_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // A row exists once a teacher touches unlock/deadline of an exercise for a course. deadline is UTC.
    `CREATE TABLE course_exercises (
      course_id   INT UNSIGNED NOT NULL,
      exercise_id INT UNSIGNED NOT NULL,
      unlocked    TINYINT(1) NOT NULL DEFAULT 0,
      deadline    DATETIME NULL,
      PRIMARY KEY (course_id, exercise_id),
      KEY ix_course_exercises_exercise (exercise_id),
      CONSTRAINT fk_ce_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
      CONSTRAINT fk_ce_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
};
