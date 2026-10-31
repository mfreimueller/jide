import type { Migration } from './index.js';

export const MIGRATION_0004_HANDINS: Migration = {
  version: 4,
  name: 'handins',
  statements: [
    // Every hand-in is kept (history); the one with the highest id of a student+exercise counts.
    // Lateness is not stored: it is derived from the course's current deadline when reading.
    `CREATE TABLE handins (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_id       INT UNSIGNED NOT NULL,
      exercise_id      INT UNSIGNED NOT NULL,
      submitted_at     DATETIME(3) NOT NULL,
      exercise_version CHAR(64) CHARACTER SET ascii NOT NULL,
      tests_passed     INT UNSIGNED NULL,
      tests_total      INT UNSIGNED NULL,
      KEY ix_handins_student_exercise (student_id, exercise_id, id),
      KEY ix_handins_exercise (exercise_id),
      CONSTRAINT fk_handins_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
      CONSTRAINT fk_handins_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE handin_files (
      handin_id INT UNSIGNED NOT NULL,
      path      VARCHAR(255) NOT NULL,
      content   MEDIUMTEXT NOT NULL,
      PRIMARY KEY (handin_id, path),
      CONSTRAINT fk_handin_files_handin FOREIGN KEY (handin_id) REFERENCES handins (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  ],
};
