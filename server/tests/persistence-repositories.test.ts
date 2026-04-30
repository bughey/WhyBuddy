import { describe, expect, it } from "vitest";

import {
  createEmailLoginTokensRepository,
  createUsersRepository,
  createProjectsRepository,
  createSessionsRepository,
  normalizeEmail,
} from "../persistence/repositories.js";

class RecordingDb {
  queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  nextRows: unknown[][] = [];

  async query<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params });
    if (/^\s*select\b/i.test(sql)) {
      return (this.nextRows.shift() ?? []) as T[];
    }
    return [];
  }
}

describe("persistence repositories", () => {
  it("normalizes email addresses before user token and lookup flows use them", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("creates users with normalized globally unique email semantics", async () => {
    const db = new RecordingDb();
    const users = createUsersRepository(db, {
      now: () => new Date("2026-04-30T00:00:00.000Z"),
      id: () => "user-1",
    });

    const user = await users.create({
      email: "  USER@Example.COM ",
      passwordHash: "password-hash",
      displayName: "Cube User",
    });
    await users.updateLastLogin("user-1", "127.0.0.1");
    await users.updateStatusAndRole("user-1", "disabled", "admin");

    expect(user.emailNormalized).toBe("user@example.com");
    expect(user.role).toBe("user");
    expect(user.status).toBe("active");
    expect(db.queries[0].sql).toMatch(/insert\s+into\s+users/i);
    expect(db.queries[0].params).toContain("user@example.com");
    expect(db.queries[1].sql).toMatch(/last_login_at/i);
    expect(db.queries[2].sql).toMatch(/status\s+=\s+\?/i);
    expect(db.queries[2].params).toEqual([
      "disabled",
      "admin",
      new Date("2026-04-30T00:00:00.000Z"),
      "user-1",
    ]);
  });

  it("stores email login token hashes and consumes only valid unexpired tokens", async () => {
    const db = new RecordingDb();
    db.nextRows.push([
      {
        id: "token-1",
        email_normalized: "user@example.com",
        user_id: "user-1",
      },
    ]);
    const tokens = createEmailLoginTokensRepository(db, {
      now: () => new Date("2026-04-30T00:00:00.000Z"),
      id: () => "token-1",
    });

    await tokens.create({
      email: "USER@Example.COM",
      userId: "user-1",
      tokenHash: "token-hash",
      requestIp: "127.0.0.1",
      userAgent: "vitest",
      expiresAt: new Date("2026-04-30T00:10:00.000Z"),
    });
    const valid = await tokens.findValidByTokenHash(
      "token-hash",
      "login",
      new Date("2026-04-30T00:05:00.000Z"),
    );
    await tokens.markConsumed("token-1");

    expect(valid).toEqual({
      id: "token-1",
      emailNormalized: "user@example.com",
      userId: "user-1",
    });
    expect(db.queries[0].sql).toMatch(/insert\s+into\s+email_login_tokens/i);
    expect(db.queries[0].sql).toMatch(/token_hash/i);
    expect(db.queries[1].sql).toMatch(/consumed_at\s+is\s+null/i);
    expect(db.queries[1].sql).toMatch(/expires_at\s+>\s+\?/i);
    expect(db.queries[2].sql).toMatch(/consumed_at/i);
    expect(JSON.stringify(db.queries)).not.toContain("plain-email-token");
  });

  it("stores revocable sessions by token hash and revokes them without token plaintext", async () => {
    const db = new RecordingDb();
    const sessions = createSessionsRepository(db, {
      now: () => new Date("2026-04-30T00:00:00.000Z"),
      id: () => "session-1",
    });

    await sessions.create({
      userId: "user-1",
      tokenHash: "hash-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
      expiresAt: new Date("2026-05-30T00:00:00.000Z"),
    });
    await sessions.revoke("session-1");

    expect(db.queries[0].sql).toMatch(/insert\s+into\s+sessions/i);
    expect(db.queries[0].sql).toMatch(/token_hash/i);
    expect(db.queries[0].params).toContain("hash-1");
    expect(JSON.stringify(db.queries)).not.toContain("plain-session-token");
    expect(db.queries[1].sql).toMatch(/revoked_at/i);
    expect(db.queries[1].params).toContain("session-1");
  });

  it("filters project lookups by owner_user_id for ordinary users", async () => {
    const db = new RecordingDb();
    db.nextRows.push([
      {
        id: "project-1",
        owner_user_id: "user-1",
        name: "Owned Project",
        description: null,
        status: "active",
        source: "user",
        created_at: new Date("2026-04-30T00:00:00.000Z"),
        updated_at: new Date("2026-04-30T00:00:00.000Z"),
        archived_at: null,
      },
    ]);
    const projects = createProjectsRepository(db);

    const project = await projects.findByIdForOwner("project-1", "user-1");

    expect(project?.id).toBe("project-1");
    expect(project?.ownerUserId).toBe("user-1");
    expect(db.queries[0].sql).toMatch(/where\s+id\s+=\s+\?/i);
    expect(db.queries[0].sql).toMatch(/owner_user_id\s+=\s+\?/i);
    expect(db.queries[0].params).toEqual(["project-1", "user-1"]);
  });
});
