import dotenv from "dotenv";

dotenv.config({ quiet: true });

const { readPersistenceConfig } = await import("../server/persistence/config.ts");
const { createMysqlQueryExecutor } = await import("../server/persistence/mysql.ts");
const { runMigrations } = await import("../server/persistence/migrations.ts");
const { pingRedis } = await import("../server/persistence/redis.ts");

const config = readPersistenceConfig();

if (config.database.provider !== "mysql") {
  throw new Error(`DATABASE_PROVIDER=${config.database.provider} is not supported by this smoke script`);
}

const db = createMysqlQueryExecutor(config.database.mysql);
try {
  await db.query("SELECT 1 AS ok");
  const first = await runMigrations(db);
  const second = await runMigrations(db);
  console.log(
    `MYSQL_OK database=${config.database.mysql.database} applied=${first.applied.length} skippedSecond=${second.skipped.length}`,
  );
} finally {
  await db.close();
}

if (config.redis.enabled) {
  const redis = await pingRedis(config.redis);
  console.log(`REDIS_${redis.ok ? "OK" : "DEGRADED"} db=${config.redis.db} prefix=${config.redis.keyPrefix}`);
} else {
  console.log(`REDIS_DISABLED prefix=${config.redis.keyPrefix}`);
}
