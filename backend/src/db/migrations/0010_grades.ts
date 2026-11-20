import type { Migration } from './index.js';

export const MIGRATION_0010_GRADES: Migration = {
  version: 10,
  name: 'grades',
  statements: [
    // One grade per student + exercise; a re-grade replaces the row and its comments. handin_id is the graded hand-in.
    `CREATE TABLE grades (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_id  INT UNSIGNED NOT NULL,
      exercise_id INT UNSIGNED NOT NULL,
      handin_id   INT UNSIGNED NOT NULL,
      symbol      VARCHAR(16) CHARACTER SET ascii NOT NULL,
      comment     TEXT NOT NULL,
      graded_at   DATETIME(3) NOT NULL,
      UNIQUE KEY uq_grades_student_exercise (student_id, exercise_id),
      KEY ix_grades_handin (handin_id),
      KEY ix_grades_exercise (exercise_id),
      CONSTRAINT fk_grades_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
      CONSTRAINT fk_grades_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
      CONSTRAINT fk_grades_handin FOREIGN KEY (handin_id) REFERENCES handins (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE grade_comments (
      id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      grade_id INT UNSIGNED NOT NULL,
      path     VARCHAR(255) NOT NULL COLLATE utf8mb4_bin,
      line     INT UNSIGNED NOT NULL,
      text     VARCHAR(1000) NOT NULL,
      KEY ix_grade_comments_grade (grade_id, id),
      CONSTRAINT fk_grade_comments_grade FOREIGN KEY (grade_id) REFERENCES grades (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
};
