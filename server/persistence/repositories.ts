import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "./mysql.js";

export type UserRole = "user" | "admin" | "super_admin";
export type UserStatus = "active" | "disabled";
export type EmailLoginTokenPurpose = "login" | "verify_email" | "reset_password";
export type ProjectStatus = "active" | "archived";
export type ProjectSource = "user" | "imported_local" | "demo";
export type ProjectResourceType =
  | "message"
  | "clarification_question"
  | "spec"
  | "route"
  | "mission"
  | "artifact"
  | "evidence";

export interface RepositoryDeps {
  now?: () => Date;
  id?: () => string;
}

export interface UserRecord {
  id: string;
  email: string;
  emailNormalized: string;
  passwordHash: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  email_verified_at: Date | string | null;
  last_login_at: Date | string | null;
  last_login_ip: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  ip: string | null;
  userAgent: string | null;
  lastSeenAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  ip: string | null;
  user_agent: string | null;
  last_seen_at: Date | string | null;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ProjectRecord {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  source: ProjectSource;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ProjectResourceRecord<TPayload = Record<string, unknown>> {
  id: string;
  projectId: string;
  resourceType: ProjectResourceType;
  payload: TPayload;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectRow {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  source: ProjectSource;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
}

interface ProjectResourceRow {
  id: string;
  project_id: string;
  resource_type: ProjectResourceType;
  payload_json: string | Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  return value == null ? null : toDate(value);
}

function defaultDeps(deps: RepositoryDeps = {}): Required<RepositoryDeps> {
  return {
    now: deps.now ?? (() => new Date()),
    id: deps.id ?? randomUUID,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.email_normalized,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    emailVerifiedAt: toNullableDate(row.email_verified_at),
    lastLoginAt: toNullableDate(row.last_login_at),
    lastLoginIp: row.last_login_ip,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    ip: row.ip,
    userAgent: row.user_agent,
    lastSeenAt: toNullableDate(row.last_seen_at),
    expiresAt: toDate(row.expires_at),
    revokedAt: toNullableDate(row.revoked_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    description: row.description,
    status: row.status,
    source: row.source,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    archivedAt: toNullableDate(row.archived_at),
  };
}

function parseProjectResourcePayload(
  value: string | Record<string, unknown>,
): Record<string, unknown> {
  if (typeof value !== "string") return value;
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : {};
}

function mapProjectResource(row: ProjectResourceRow): ProjectResourceRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    resourceType: row.resource_type,
    payload: parseProjectResourcePayload(row.payload_json),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function createUsersRepository(db: QueryExecutor, deps?: RepositoryDeps) {
  const helpers = defaultDeps(deps);

  return {
    async findById(userId: string): Promise<UserRecord | null> {
      const rows = await db.query<UserRow>(
        `SELECT id, email, email_normalized, password_hash, display_name, avatar_url, role, status,
                email_verified_at, last_login_at, last_login_ip, created_at, updated_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },

    async list(): Promise<UserRecord[]> {
      const rows = await db.query<UserRow>(
        `SELECT id, email, email_normalized, password_hash, display_name, avatar_url, role, status,
                email_verified_at, last_login_at, last_login_ip, created_at, updated_at
         FROM users
         ORDER BY created_at DESC`,
      );
      return rows.map(mapUser);
    },

    async findByEmail(email: string): Promise<UserRecord | null> {
      const rows = await db.query<UserRow>(
        `SELECT id, email, email_normalized, password_hash, display_name, avatar_url, role, status,
                email_verified_at, last_login_at, last_login_ip, created_at, updated_at
         FROM users
         WHERE email_normalized = ?
         LIMIT 1`,
        [normalizeEmail(email)],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },

    async create(input: {
      email: string;
      passwordHash?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      role?: UserRole;
      status?: UserStatus;
      emailVerifiedAt?: Date | null;
    }): Promise<UserRecord> {
      const now = helpers.now();
      const id = helpers.id();
      const emailNormalized = normalizeEmail(input.email);
      const role = input.role ?? "user";
      const status = input.status ?? "active";

      await db.query(
        `INSERT INTO users
          (id, email, email_normalized, password_hash, display_name, avatar_url, role, status,
           email_verified_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.email.trim(),
          emailNormalized,
          input.passwordHash ?? null,
          input.displayName ?? null,
          input.avatarUrl ?? null,
          role,
          status,
          input.emailVerifiedAt ?? null,
          now,
          now,
        ],
      );

      return {
        id,
        email: input.email.trim(),
        emailNormalized,
        passwordHash: input.passwordHash ?? null,
        displayName: input.displayName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        role,
        status,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        lastLoginAt: null,
        lastLoginIp: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async updateLastLogin(userId: string, ip: string | null = null): Promise<void> {
      const now = helpers.now();
      await db.query("UPDATE users SET last_login_at = ?, last_login_ip = ?, updated_at = ? WHERE id = ?", [
        now,
        ip,
        now,
        userId,
      ]);
    },

    async markEmailVerified(userId: string, verifiedAt: Date = helpers.now()): Promise<void> {
      const now = helpers.now();
      await db.query(
        "UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ? AND email_verified_at IS NULL",
        [verifiedAt, now, userId],
      );
    },

    async updateStatusAndRole(userId: string, status: UserStatus, role: UserRole): Promise<void> {
      await db.query("UPDATE users SET status = ?, role = ?, updated_at = ? WHERE id = ?", [
        status,
        role,
        helpers.now(),
        userId,
      ]);
    },
  };
}

export function createEmailLoginTokensRepository(db: QueryExecutor, deps?: RepositoryDeps) {
  const helpers = defaultDeps(deps);

  return {
    async create(input: {
      email: string;
      userId?: string | null;
      purpose?: EmailLoginTokenPurpose;
      tokenHash: string;
      requestIp?: string | null;
      userAgent?: string | null;
      expiresAt: Date;
    }): Promise<string> {
      const id = helpers.id();
      await db.query(
        `INSERT INTO email_login_tokens
          (id, email_normalized, user_id, purpose, token_hash, request_ip, user_agent, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          normalizeEmail(input.email),
          input.userId ?? null,
          input.purpose ?? "login",
          input.tokenHash,
          input.requestIp ?? null,
          input.userAgent ?? null,
          input.expiresAt,
          helpers.now(),
        ],
      );
      return id;
    },

    async findValidByTokenHash(
      tokenHash: string,
      purpose: EmailLoginTokenPurpose,
      now: Date = helpers.now(),
    ): Promise<{ id: string; emailNormalized: string; userId: string | null } | null> {
      const rows = await db.query<{
        id: string;
        email_normalized: string;
        user_id: string | null;
      }>(
        `SELECT id, email_normalized, user_id
         FROM email_login_tokens
         WHERE token_hash = ?
           AND purpose = ?
           AND consumed_at IS NULL
           AND expires_at > ?
         LIMIT 1`,
        [tokenHash, purpose, now],
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            emailNormalized: row.email_normalized,
            userId: row.user_id,
          }
        : null;
    },

    async markConsumed(tokenId: string): Promise<void> {
      await db.query("UPDATE email_login_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL", [
        helpers.now(),
        tokenId,
      ]);
    },

    async countCreatedSince(
      email: string,
      purpose: EmailLoginTokenPurpose,
      since: Date,
    ): Promise<number> {
      const rows = await db.query<{ count: number | string }>(
        `SELECT COUNT(*) AS count
         FROM email_login_tokens
         WHERE email_normalized = ?
           AND purpose = ?
           AND created_at >= ?`,
        [normalizeEmail(email), purpose, since],
      );
      return Number(rows[0]?.count ?? 0);
    },
  };
}

export function createSessionsRepository(db: QueryExecutor, deps?: RepositoryDeps) {
  const helpers = defaultDeps(deps);

  return {
    async create(input: {
      userId: string;
      tokenHash: string;
      ip?: string | null;
      userAgent?: string | null;
      expiresAt: Date;
    }): Promise<SessionRecord> {
      const now = helpers.now();
      const id = helpers.id();
      await db.query(
        `INSERT INTO sessions
          (id, user_id, token_hash, ip, user_agent, last_seen_at, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.userId,
          input.tokenHash,
          input.ip ?? null,
          input.userAgent ?? null,
          now,
          input.expiresAt,
          now,
          now,
        ],
      );
      return {
        id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        lastSeenAt: now,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async findActiveByTokenHash(tokenHash: string, now: Date = helpers.now()): Promise<SessionRecord | null> {
      const rows = await db.query<SessionRow>(
        `SELECT id, user_id, token_hash, ip, user_agent, last_seen_at, expires_at, revoked_at, created_at, updated_at
         FROM sessions
         WHERE token_hash = ?
           AND revoked_at IS NULL
           AND expires_at > ?
         LIMIT 1`,
        [tokenHash, now],
      );
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async refreshLastSeen(sessionId: string, expiresAt?: Date): Promise<void> {
      const now = helpers.now();
      if (expiresAt) {
        await db.query("UPDATE sessions SET last_seen_at = ?, expires_at = ?, updated_at = ? WHERE id = ?", [
          now,
          expiresAt,
          now,
          sessionId,
        ]);
        return;
      }

      await db.query("UPDATE sessions SET last_seen_at = ?, updated_at = ? WHERE id = ?", [now, now, sessionId]);
    },

    async revoke(sessionId: string): Promise<void> {
      const now = helpers.now();
      await db.query("UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE id = ? AND revoked_at IS NULL", [
        now,
        now,
        sessionId,
      ]);
    },

    async cleanupExpired(now: Date = helpers.now()): Promise<void> {
      await db.query("DELETE FROM sessions WHERE expires_at <= ?", [now]);
    },
  };
}

export function createProjectsRepository(db: QueryExecutor, deps?: RepositoryDeps) {
  const helpers = defaultDeps(deps);

  return {
    async create(input: {
      ownerUserId: string;
      name: string;
      description?: string | null;
      source?: ProjectSource;
    }): Promise<ProjectRecord> {
      const now = helpers.now();
      const id = helpers.id();
      await db.query(
        `INSERT INTO projects
          (id, owner_user_id, name, description, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
        [id, input.ownerUserId, input.name, input.description ?? null, input.source ?? "user", now, now],
      );
      return {
        id,
        ownerUserId: input.ownerUserId,
        name: input.name,
        description: input.description ?? null,
        status: "active",
        source: input.source ?? "user",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
    },

    async listForOwner(ownerUserId: string): Promise<ProjectRecord[]> {
      const rows = await db.query<ProjectRow>(
        `SELECT id, owner_user_id, name, description, status, source, created_at, updated_at, archived_at
         FROM projects
         WHERE owner_user_id = ?
         ORDER BY updated_at DESC`,
        [ownerUserId],
      );
      return rows.map(mapProject);
    },

    async list(): Promise<ProjectRecord[]> {
      const rows = await db.query<ProjectRow>(
        `SELECT id, owner_user_id, name, description, status, source, created_at, updated_at, archived_at
         FROM projects
         ORDER BY updated_at DESC`,
      );
      return rows.map(mapProject);
    },

    async findById(projectId: string): Promise<ProjectRecord | null> {
      const rows = await db.query<ProjectRow>(
        `SELECT id, owner_user_id, name, description, status, source, created_at, updated_at, archived_at
         FROM projects
         WHERE id = ?
         LIMIT 1`,
        [projectId],
      );
      return rows[0] ? mapProject(rows[0]) : null;
    },

    async findByIdForOwner(projectId: string, ownerUserId: string): Promise<ProjectRecord | null> {
      const rows = await db.query<ProjectRow>(
        `SELECT id, owner_user_id, name, description, status, source, created_at, updated_at, archived_at
         FROM projects
         WHERE id = ?
           AND owner_user_id = ?
         LIMIT 1`,
        [projectId, ownerUserId],
      );
      return rows[0] ? mapProject(rows[0]) : null;
    },

    async updateForOwner(
      projectId: string,
      ownerUserId: string,
      patch: {
        name?: string;
        description?: string | null;
        status?: ProjectStatus;
      },
    ): Promise<ProjectRecord | null> {
      const assignments: string[] = [];
      const params: unknown[] = [];

      if (patch.name !== undefined) {
        assignments.push("name = ?");
        params.push(patch.name);
      }
      if (patch.description !== undefined) {
        assignments.push("description = ?");
        params.push(patch.description);
      }
      if (patch.status !== undefined) {
        assignments.push("status = ?");
        params.push(patch.status);
        assignments.push("archived_at = ?");
        params.push(patch.status === "archived" ? helpers.now() : null);
      }

      if (assignments.length > 0) {
        const now = helpers.now();
        await db.query(
          `UPDATE projects
           SET ${assignments.join(", ")}, updated_at = ?
           WHERE id = ?
             AND owner_user_id = ?`,
          [...params, now, projectId, ownerUserId],
        );
      }

      return this.findByIdForOwner(projectId, ownerUserId);
    },

    async archiveForOwner(projectId: string, ownerUserId: string): Promise<void> {
      const now = helpers.now();
      await db.query(
        `UPDATE projects
         SET status = 'archived', archived_at = ?, updated_at = ?
         WHERE id = ?
           AND owner_user_id = ?`,
        [now, now, projectId, ownerUserId],
      );
    },
  };
}

export function createProjectResourcesRepository(
  db: QueryExecutor,
  deps?: RepositoryDeps,
) {
  const helpers = defaultDeps(deps);

  return {
    async listForProject(
      projectId: string,
    ): Promise<ProjectResourceRecord[]> {
      const rows = await db.query<ProjectResourceRow>(
        `SELECT id, project_id, resource_type, payload_json, created_at, updated_at
         FROM project_resources
         WHERE project_id = ?
         ORDER BY created_at ASC`,
        [projectId],
      );
      return rows.map(mapProjectResource);
    },

    async create<TPayload extends Record<string, unknown>>(input: {
      projectId: string;
      resourceType: ProjectResourceType;
      payload: TPayload;
    }): Promise<ProjectResourceRecord<TPayload>> {
      const now = helpers.now();
      const id = helpers.id();
      await db.query(
        `INSERT INTO project_resources
          (id, project_id, resource_type, payload_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.projectId,
          input.resourceType,
          JSON.stringify(input.payload),
          now,
          now,
        ],
      );
      return {
        id,
        projectId: input.projectId,
        resourceType: input.resourceType,
        payload: input.payload,
        createdAt: now,
        updatedAt: now,
      };
    },
  };
}
