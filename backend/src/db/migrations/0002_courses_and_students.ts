import type { Migration } from './index.js';

export const MIGRATION_0002_COURSES_AND_STUDENTS: Migration = {
  version: 2,
  name: 'courses_and_students',
  statements: [
    `CREATE TABLE courses (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      teacher_id INT UNSIGNED NOT NULL,
      subject    VARCHAR(50) NOT NULL,
      class_name VARCHAR(50) NOT NULL,
      archived   TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      KEY ix_courses_teacher (teacher_id),
      CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // The code is the student's bearer token, stored readable (needed for the code sheet).
    `CREATE TABLE students (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      course_id        INT UNSIGNED NOT NULL,
      name             VARCHAR(100) NOT NULL,
      code             CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      last_activity_at DATETIME NULL,
      created_at       DATETIME NOT NULL,
      UNIQUE KEY uq_students_code (code),
      KEY ix_students_course (course_id),
      CONSTRAINT fk_students_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
};
