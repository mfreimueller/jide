import type { Migration } from './index.js';

export const MIGRATION_0006_EXERCISE_GROUPS: Migration = {
  version: 6,
  name: 'exercise_groups',
  statements: [
    // Groups belong to a course; position is dense (0, 1, 2, ...) inside the course.
    `CREATE TABLE exercise_groups (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      course_id  INT UNSIGNED NOT NULL,
      name       VARCHAR(100) NOT NULL,
      position   INT NOT NULL,
      created_at DATETIME NOT NULL,
      UNIQUE KEY uq_exercise_groups_course_name (course_id, name),
      CONSTRAINT fk_eg_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // An exercise is in one group or none per course. position orders the exercises inside the group (NULL = ungrouped).
    `ALTER TABLE course_exercises
      ADD COLUMN group_id INT UNSIGNED NULL,
      ADD COLUMN position INT NULL,
      ADD KEY ix_course_exercises_group (group_id),
      ADD CONSTRAINT fk_ce_group FOREIGN KEY (group_id) REFERENCES exercise_groups (id) ON DELETE SET NULL`,
  ],
};
