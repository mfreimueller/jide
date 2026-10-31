import type { Migration } from './index.js';

// Timestamps are written from JS (UTC) rather than relying on server defaults.
export const MIGRATION_0001_TEACHERS_AND_AUTH: Migration = {
  version: 1,
  name: 'teachers_and_auth',
  statements: [
    `CREATE TABLE teachers (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email        VARCHAR(255) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      created_at   DATETIME NOT NULL,
      UNIQUE KEY uq_teachers_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE login_tokens (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      teacher_id INT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at    DATETIME NULL,
      created_at DATETIME NOT NULL,
      UNIQUE KEY uq_login_tokens_hash (token_hash),
      CONSTRAINT fk_login_tokens_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE teacher_sessions (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      teacher_id INT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      UNIQUE KEY uq_teacher_sessions_hash (token_hash),
      CONSTRAINT fk_teacher_sessions_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
};
