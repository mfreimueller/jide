import type { Migration } from './index.js';

export const MIGRATION_0012_PRACTICE_HOSTS: Migration = {
  version: 12,
  name: 'practice_hosts',
  statements: [
    // Hosts a course's practice zips (jide://practice links) may be downloaded from; set by the teacher, no default.
    `CREATE TABLE course_practice_hosts (
      course_id INT UNSIGNED NOT NULL,
      host      VARCHAR(253) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      PRIMARY KEY (course_id, host),
      CONSTRAINT fk_cph_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
};
