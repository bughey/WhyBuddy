import mysql, { type Pool, type QueryOptions } from "mysql2/promise";

import type { MysqlConfig } from "./config.js";

export interface QueryExecutor {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

export interface ClosableQueryExecutor extends QueryExecutor {
  close(): Promise<void>;
}

export function createMysqlPool(config: MysqlConfig): Pool {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password || undefined,
    waitForConnections: config.pool.waitForConnections,
    connectionLimit: config.pool.connectionLimit,
    queueLimit: config.pool.queueLimit,
    connectTimeout: config.pool.connectTimeoutMs,
    charset: "utf8mb4_unicode_ci",
  });
}

export class MysqlQueryExecutor implements ClosableQueryExecutor {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async query<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    const options: QueryOptions = { sql, values: [...params] };
    const [rows] = await this.pool.query(options);
    return Array.isArray(rows) ? (rows as T[]) : ([] as T[]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createMysqlQueryExecutor(config: MysqlConfig): ClosableQueryExecutor {
  return new MysqlQueryExecutor(createMysqlPool(config));
}
