import type { Migration } from './index.js';

export const MIGRATION_0009_API_KEYS: Migration = {
  version: 9,
  name: 'api_keys',
  statements: [
    // API keys for the grading API (grader). Only the SHA-256 hash of the key is stored; prefix is the start of
    // the key as shown in the list. Revoked keys keep their row (revoked_at) but stop working.
    `CREATE TABLE api_keys (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      teacher_id   INT UNSIGNED NOT NULL,
      name         VARCHAR(100) NOT NULL,
      token_hash   CHAR(64) CHARACTER SET ascii NOT NULL,
      prefix       VARCHAR(16) CHARACTER SET ascii NOT NULL,
      created_at   DATETIME NOT NULL,
      last_used_at DATETIME NULL,
      revoked_at   DATETIME NULL,
      UNIQUE KEY uq_api_keys_hash (token_hash),
      KEY ix_api_keys_teacher (teacher_id),
      CONSTRAINT fk_api_keys_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
};
