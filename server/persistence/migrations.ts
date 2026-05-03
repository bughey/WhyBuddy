import { createHash } from "node:crypto";

import type { QueryExecutor } from "./mysql.js";

export interface Migration {
  id: string;
  name: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

const SCHEMA_MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const INITIAL_AUTH_PROJECT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  email_normalized VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NULL,
  display_name VARCHAR(120) NULL,
  avatar_url VARCHAR(1024) NULL,
  role ENUM('user', 'admin', 'super_admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  last_login_ip VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_users_email_normalized (email_normalized),
  KEY idx_users_role_status (role, status),
  KEY idx_users_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_login_tokens (
  id VARCHAR(36) PRIMARY KEY,
  email_normalized VARCHAR(320) NOT NULL,
  user_id VARCHAR(36) NULL,
  purpose ENUM('login', 'verify_email', 'reset_password') NOT NULL DEFAULT 'login',
  token_hash VARCHAR(128) NOT NULL,
  request_ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_email_login_tokens_hash (token_hash),
  KEY idx_email_login_tokens_email_purpose_expires (email_normalized, purpose, expires_at),
  KEY idx_email_login_tokens_user (user_id),
  CONSTRAINT fk_email_login_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  last_seen_at DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_sessions_token_hash (token_hash),
  KEY idx_sessions_user_active (user_id, revoked_at, expires_at),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  source ENUM('user', 'imported_local', 'demo') NOT NULL DEFAULT 'user',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  KEY idx_projects_owner_status_updated (owner_user_id, status, updated_at),
  KEY idx_projects_updated (updated_at),
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const PROJECT_RESOURCES_SQL = `
CREATE TABLE IF NOT EXISTS project_resources (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  resource_type ENUM('message', 'clarification_question', 'spec', 'route', 'mission', 'artifact', 'evidence') NOT NULL,
  payload_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_project_resources_project_type_created (project_id, resource_type, created_at),
  CONSTRAINT fk_project_resources_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const AUTH_PROJECT_MIGRATIONS: readonly Migration[] = [
  {
    id: "001_initial_auth_project",
    name: "Initial ToC auth sessions and owned projects",
    sql: INITIAL_AUTH_PROJECT_SQL,
  },
  {
    id: "002_project_resources",
    name: "Project scoped resources for owner-guarded bundles",
    sql: PROJECT_RESOURCES_SQL,
  },
];

export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function checksumSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export async function runMigrations(
  db: QueryExecutor,
  migrations: readonly Migration[] = AUTH_PROJECT_MIGRATIONS,
): Promise<MigrationResult> {
  await db.query(SCHEMA_MIGRATIONS_SQL);

  const rows = await db.query<{ id: string }>("SELECT id FROM schema_migrations");
  const appliedIds = new Set(rows.map((row) => row.id));
  const result: MigrationResult = {
    applied: [],
    skipped: [],
  };

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      result.skipped.push(migration.id);
      continue;
    }

    for (const statement of splitSqlStatements(migration.sql)) {
      await db.query(statement);
    }

    await db.query(
      "INSERT INTO schema_migrations (id, name, checksum) VALUES (?, ?, ?)",
      [migration.id, migration.name, checksumSql(migration.sql)],
    );
    result.applied.push(migration.id);
  }

  return result;
}
