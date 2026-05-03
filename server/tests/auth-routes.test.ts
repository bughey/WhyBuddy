import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import { hashPassword } from "../auth/password.js";
import { createEmailCodeService, type EmailCodeMailer, type EmailCodeService } from "../auth/email-code-service.js";
import { createSessionService, hashSessionToken } from "../auth/session-service.js";
import type {
  EmailLoginTokenPurpose,
  SessionRecord,
  UserRecord,
  UserRole,
  UserStatus,
} from "../persistence/repositories.js";
import { createAuthRouter } from "../routes/auth.js";

class MemoryUsersRepository {
  users = new Map<string, UserRecord>();
  nextId = 1;

  async findById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    return [...this.users.values()].find((user) => user.emailNormalized === normalized) ?? null;
  }

  async create(input: {
    email: string;
    passwordHash?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    role?: UserRole;
    status?: UserStatus;
    emailVerifiedAt?: Date | null;
  }): Promise<UserRecord> {
    const emailNormalized = input.email.trim().toLowerCase();
    if (await this.findByEmail(emailNormalized)) {
      throw Object.assign(new Error("Duplicate email"), { code: "ER_DUP_ENTRY" });
    }

    const now = new Date("2026-04-30T00:00:00.000Z");
    const user: UserRecord = {
      id: `user-${this.nextId++}`,
      email: input.email.trim(),
      emailNormalized,
      passwordHash: input.passwordHash ?? null,
      displayName: input.displayName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: input.role ?? "user",
      status: input.status ?? "active",
      emailVerifiedAt: input.emailVerifiedAt ?? null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateLastLogin(userId: string, ip: string | null = null): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.lastLoginAt = new Date("2026-04-30T00:01:00.000Z");
    user.lastLoginIp = ip;
  }

  async markEmailVerified(userId: string, verifiedAt = new Date("2026-04-30T00:04:00.000Z")): Promise<void> {
    const user = this.users.get(userId);
    if (!user || user.emailVerifiedAt) return;
    user.emailVerifiedAt = verifiedAt;
  }
}

class MemorySessionsRepository {
  sessions = new Map<string, SessionRecord>();
  nextId = 1;

  async create(input: {
    userId: string;
    tokenHash: string;
    ip?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    const now = new Date("2026-04-30T00:00:00.000Z");
    const session: SessionRecord = {
      id: `session-${this.nextId++}`,
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
    this.sessions.set(session.id, session);
    return session;
  }

  async findActiveByTokenHash(tokenHash: string, now = new Date()): Promise<SessionRecord | null> {
    return (
      [...this.sessions.values()].find(
        (session) => session.tokenHash === tokenHash && session.revokedAt == null && session.expiresAt > now,
      ) ?? null
    );
  }

  async refreshLastSeen(sessionId: string, expiresAt?: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastSeenAt = new Date("2026-04-30T00:02:00.000Z");
      if (expiresAt) {
        session.expiresAt = expiresAt;
      }
    }
  }

  async revoke(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revokedAt = new Date("2026-04-30T00:03:00.000Z");
    }
  }
}

interface MemoryEmailLoginToken {
  id: string;
  emailNormalized: string;
  userId: string | null;
  purpose: EmailLoginTokenPurpose;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

class MemoryEmailLoginTokensRepository {
  tokens = new Map<string, MemoryEmailLoginToken>();
  nextId = 1;

  async create(input: {
    email: string;
    userId?: string | null;
    purpose?: EmailLoginTokenPurpose;
    tokenHash: string;
    requestIp?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
  }): Promise<string> {
    const id = `email-token-${this.nextId++}`;
    this.tokens.set(id, {
      id,
      emailNormalized: input.email.trim().toLowerCase(),
      userId: input.userId ?? null,
      purpose: input.purpose ?? "login",
      tokenHash: input.tokenHash,
      createdAt: new Date("2026-04-30T00:00:00.000Z"),
      expiresAt: input.expiresAt,
      consumedAt: null,
    });
    return id;
  }

  async findValidByTokenHash(
    tokenHash: string,
    purpose: EmailLoginTokenPurpose,
    now = new Date("2026-04-30T00:00:00.000Z"),
  ): Promise<{ id: string; emailNormalized: string; userId: string | null } | null> {
    const token =
      [...this.tokens.values()].find(
        item =>
          item.tokenHash === tokenHash &&
          item.purpose === purpose &&
          item.consumedAt == null &&
          item.expiresAt > now
      ) ?? null;
    return token
      ? {
          id: token.id,
          emailNormalized: token.emailNormalized,
          userId: token.userId,
        }
      : null;
  }

  async markConsumed(tokenId: string): Promise<void> {
    const token = this.tokens.get(tokenId);
    if (token && token.consumedAt == null) {
      token.consumedAt = new Date("2026-04-30T00:05:00.000Z");
    }
  }

  async countCreatedSince(
    email: string,
    purpose: EmailLoginTokenPurpose,
    since: Date,
  ): Promise<number> {
    const normalized = email.trim().toLowerCase();
    return [...this.tokens.values()].filter(
      token =>
        token.emailNormalized === normalized &&
        token.purpose === purpose &&
        token.createdAt >= since
    ).length;
  }
}

class RecordingEmailCodeMailer implements EmailCodeMailer {
  deliveries: Array<{ email: string; code: string; expiresInMinutes: number }> = [];

  async sendLoginCode(input: { email: string; code: string; expiresInMinutes: number }): Promise<void> {
    this.deliveries.push(input);
  }
}

async function withAuthServer(
  setup: (deps: {
    users: MemoryUsersRepository;
    sessions: MemorySessionsRepository;
    emailTokens: MemoryEmailLoginTokensRepository;
    emailCodeService: EmailCodeService;
    mailer: RecordingEmailCodeMailer;
    cookieName: string;
  }) => Promise<void> | void,
  handler: (baseUrl: string, deps: {
    users: MemoryUsersRepository;
    sessions: MemorySessionsRepository;
    emailTokens: MemoryEmailLoginTokensRepository;
    emailCodeService: EmailCodeService;
    mailer: RecordingEmailCodeMailer;
    cookieName: string;
  }) => Promise<void>,
) {
  const users = new MemoryUsersRepository();
  const sessions = new MemorySessionsRepository();
  const emailTokens = new MemoryEmailLoginTokensRepository();
  const mailer = new RecordingEmailCodeMailer();
  const cookieName = "cube_test_session";
  const service = createSessionService({
    repositories: { users, sessions },
    cookieName,
    ttlDays: 30,
    now: () => new Date("2026-04-30T00:00:00.000Z"),
  });
  const emailCodeService = createEmailCodeService({
    mailer,
    ttlSeconds: 600,
    pepper: "test-pepper",
    now: () => new Date("2026-04-30T00:00:00.000Z"),
  });

  await setup({ users, sessions, emailTokens, emailCodeService, mailer, cookieName });

  const app = express();
  app.use(express.json());
  app.use(
    "/api/auth",
    createAuthRouter({
      users,
      sessions,
      sessionService: service,
      emailLoginTokens: emailTokens,
      emailCodeService,
    }),
  );

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => (error ? reject(error) : resolve()));
  });

  const address = server.address() as AddressInfo;
  try {
    await handler(`http://127.0.0.1:${address.port}`, {
      users,
      sessions,
      emailTokens,
      emailCodeService,
      mailer,
      cookieName,
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

}

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("set-cookie");
  expect(cookie).toContain("HttpOnly");
  return cookie?.split(";")[0] ?? "";
}

describe("auth routes", () => {
  it("registers a user, sets an httpOnly cookie, and never returns secrets", async () => {
    await withAuthServer(
      () => undefined,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "  USER@Example.COM ",
            password: "password123",
            displayName: "Cube User",
          }),
        });
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(response.headers.get("set-cookie")).toContain("HttpOnly");
        expect(body).toMatchObject({
          success: true,
          user: {
            email: "user@example.com",
            displayName: "Cube User",
            role: "user",
            status: "active",
          },
        });
        expect(JSON.stringify(body)).not.toContain("passwordHash");
        expect(JSON.stringify(body)).not.toContain("tokenHash");
      },
    );
  });

  it("returns 409 for duplicate email registration", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "USER@example.com", password: "password123" }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ success: false });
      },
    );
  });

  it("returns a generic 401 for wrong login credentials", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", password: "wrong-password" }),
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ success: false, error: "邮箱或密码错误" });
      },
    );
  });

  it("restores the current user through GET /api/auth/me", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
      },
      async (baseUrl) => {
        const login = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", password: "password123" }),
        });
        const cookie = cookieFrom(login);
        const response = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { cookie },
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.user.email).toBe("user@example.com");
        expect(JSON.stringify(body)).not.toContain("passwordHash");
      },
    );
  });

  it("refreshes the current DB session", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
      },
      async (baseUrl, { sessions }) => {
        const login = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", password: "password123" }),
        });
        const cookie = cookieFrom(login);
        const [session] = [...sessions.sessions.values()];
        const before = session?.lastSeenAt?.toISOString();

        const refresh = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: "POST",
          headers: { cookie },
        });

        expect(refresh.status).toBe(200);
        expect(session?.lastSeenAt?.toISOString()).not.toBe(before);
        expect(session?.expiresAt.toISOString()).toBe("2026-05-30T00:00:00.000Z");
      },
    );
  });

  it("revokes the session and clears the cookie on logout", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
      },
      async (baseUrl, { sessions }) => {
        const login = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", password: "password123" }),
        });
        const cookie = cookieFrom(login);
        const token = cookie.split("=")[1] ?? "";

        const logout = await fetch(`${baseUrl}/api/auth/logout`, {
          method: "POST",
          headers: { cookie },
        });

        expect(logout.status).toBe(200);
        expect(logout.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
        const session = await sessions.findActiveByTokenHash(hashSessionToken(token));
        expect(session).toBeNull();
      },
    );
  });

  it("blocks disabled users from logging in", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "disabled@example.com",
          passwordHash: await hashPassword("password123"),
          status: "disabled",
        });
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "disabled@example.com", password: "password123" }),
        });

        expect(response.status).toBe(403);
      },
    );
  });

  it("sends a one-time email code without storing the plaintext code", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
      },
      async (baseUrl, { emailTokens, mailer }) => {
        const response = await fetch(`${baseUrl}/api/auth/email-code/send`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "vitest",
          },
          body: JSON.stringify({ email: "  USER@Example.COM " }),
        });
        const body = await response.json();
        const [delivery] = mailer.deliveries;
        const [token] = [...emailTokens.tokens.values()];

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, expiresInSeconds: 600 });
        expect(delivery?.email).toBe("user@example.com");
        expect(delivery?.code).toMatch(/^\d{6}$/);
        expect(token?.emailNormalized).toBe("user@example.com");
        expect(token?.expiresAt.toISOString()).toBe("2026-04-30T00:10:00.000Z");
        expect(token?.tokenHash).not.toBe(delivery?.code);
      },
    );
  });

  it("returns generic success without sending a code for an unknown account", async () => {
    await withAuthServer(
      () => undefined,
      async (baseUrl, { emailTokens, mailer }) => {
        const response = await fetch(`${baseUrl}/api/auth/email-code/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "missing@example.com" }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, expiresInSeconds: 600 });
        expect(mailer.deliveries).toHaveLength(0);
        expect(emailTokens.tokens.size).toBe(0);
      },
    );
  });

  it("rate-limits recent email code requests without exposing the account", async () => {
    await withAuthServer(
      async ({ users, emailTokens, emailCodeService }) => {
        const user = await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
        for (let index = 0; index < 5; index += 1) {
          await emailTokens.create({
            email: "user@example.com",
            userId: user.id,
            purpose: "login",
            tokenHash: emailCodeService.hashCode("user@example.com", `00000${index}`.slice(-6)),
            expiresAt: new Date("2026-04-30T00:10:00.000Z"),
          });
        }
      },
      async (baseUrl, { emailTokens, mailer }) => {
        const response = await fetch(`${baseUrl}/api/auth/email-code/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com" }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, expiresInSeconds: 600 });
        expect(emailTokens.tokens.size).toBe(5);
        expect(mailer.deliveries).toHaveLength(0);
      },
    );
  });

  it("logs in with a valid email code, consumes it, and marks the email verified", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
      },
      async (baseUrl, { emailTokens, mailer, users }) => {
        await fetch(`${baseUrl}/api/auth/email-code/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com" }),
        });
        const code = mailer.deliveries[0]?.code ?? "";

        const login = await fetch(`${baseUrl}/api/auth/email-code/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "USER@example.com", code }),
        });
        const body = await login.json();
        const [token] = [...emailTokens.tokens.values()];
        const user = await users.findByEmail("user@example.com");

        expect(login.status).toBe(200);
        expect(login.headers.get("set-cookie")).toContain("HttpOnly");
        expect(body.user.email).toBe("user@example.com");
        expect(body.user.emailVerified).toBe(true);
        expect(token?.consumedAt).toBeInstanceOf(Date);
        expect(user?.emailVerifiedAt?.toISOString()).toBe("2026-04-30T00:00:00.000Z");
        expect(user?.lastLoginAt?.toISOString()).toBe("2026-04-30T00:01:00.000Z");
      },
    );
  });

  it("rejects reused and expired email codes", async () => {
    await withAuthServer(
      async ({ users, emailTokens, emailCodeService }) => {
        const user = await users.create({
          email: "user@example.com",
          passwordHash: await hashPassword("password123"),
        });
        await emailTokens.create({
          email: "user@example.com",
          userId: user.id,
          purpose: "login",
          tokenHash: emailCodeService.hashCode("user@example.com", "000000"),
          expiresAt: new Date("2026-04-29T23:59:00.000Z"),
        });
      },
      async (baseUrl, { mailer }) => {
        await fetch(`${baseUrl}/api/auth/email-code/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com" }),
        });
        const code = mailer.deliveries[0]?.code ?? "";

        const first = await fetch(`${baseUrl}/api/auth/email-code/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", code }),
        });
        const reused = await fetch(`${baseUrl}/api/auth/email-code/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", code }),
        });
        const expired = await fetch(`${baseUrl}/api/auth/email-code/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", code: "000000" }),
        });

        expect(first.status).toBe(200);
        expect(reused.status).toBe(401);
        expect(expired.status).toBe(401);
      },
    );
  });

  it("blocks disabled users from logging in with an email code", async () => {
    await withAuthServer(
      async ({ users }) => {
        await users.create({
          email: "disabled@example.com",
          passwordHash: await hashPassword("password123"),
          status: "disabled",
        });
      },
      async (baseUrl, { mailer }) => {
        const send = await fetch(`${baseUrl}/api/auth/email-code/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "disabled@example.com" }),
        });
        const login = await fetch(`${baseUrl}/api/auth/email-code/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "disabled@example.com", code: mailer.deliveries[0]?.code ?? "000000" }),
        });

        expect(send.status).toBe(200);
        expect(mailer.deliveries).toHaveLength(0);
        expect(login.status).toBe(401);
      },
    );
  });
});
