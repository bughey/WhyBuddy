import { describe, expect, it } from "vitest";

import {
  AUTH_PROJECT_MIGRATIONS,
  runMigrations,
  splitSqlStatements,
} from "../persistence/migrations.js";

class FakeMigrationDb {
  applied = new Set<string>();
  statements: Array<{ sql: string; params: readonly unknown[] }> = [];

  async query<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    this.statements.push({ sql, params });

    if (/select\s+id\s+from\s+schema_migrations/i.test(sql)) {
      return [...this.applied].map((id) => ({ id })) as T[];
    }

    if (/insert\s+into\s+schema_migrations/i.test(sql)) {
      this.applied.add(String(params[0]));
    }

    return [];
  }
}

describe("migration runner", () => {
  it("creates schema_migrations and skips migrations that are already applied", async () => {
    const db = new FakeMigrationDb();
    const migrations = [
      {
        id: "001",
        name: "first",
        sql: "CREATE TABLE IF NOT EXISTS example_one (id VARCHAR(64) PRIMARY KEY);",
      },
    ];

    const first = await runMigrations(db, migrations);
    const second = await runMigrations(db, migrations);

    expect(first.applied).toEqual(["001"]);
    expect(first.skipped).toEqual([]);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["001"]);
    expect(db.statements.some((entry) => /create\s+table\s+if\s+not\s+exists\s+schema_migrations/i.test(entry.sql))).toBe(true);
    expect(
      db.statements.filter((entry) => /create\s+table\s+if\s+not\s+exists\s+example_one/i.test(entry.sql)),
    ).toHaveLength(1);
  });

  it("defines the initial auth and project ownership tables", () => {
    const initialSql = AUTH_PROJECT_MIGRATIONS.map((migration) => migration.sql).join("\n");

    expect(initialSql).toMatch(/CREATE TABLE IF NOT EXISTS users/i);
    expect(initialSql).toMatch(/CREATE TABLE IF NOT EXISTS email_login_tokens/i);
    expect(initialSql).toMatch(/CREATE TABLE IF NOT EXISTS sessions/i);
    expect(initialSql).toMatch(/CREATE TABLE IF NOT EXISTS projects/i);
    expect(initialSql).toMatch(/CREATE TABLE IF NOT EXISTS project_resources/i);
    expect(initialSql).toMatch(/owner_user_id/i);
    expect(initialSql).toMatch(/resource_type/i);
    expect(initialSql).toMatch(/payload_json/i);
    expect(initialSql).toMatch(/revoked_at/i);
    expect(initialSql).toMatch(/token_hash/i);
  });

  it("splits a migration script into executable SQL statements", () => {
    expect(
      splitSqlStatements(`
        CREATE TABLE a (id INT);
        CREATE TABLE b (id INT);
      `),
    ).toEqual(["CREATE TABLE a (id INT)", "CREATE TABLE b (id INT)"]);
  });
});
