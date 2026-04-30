import net from "node:net";

import type { RedisConfig } from "./config.js";

export interface RedisPingResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

function encodeRedisCommand(parts: readonly string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

function readRedisResponse(socket: net.Socket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Redis response timeout"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
    };

    const onData = (data: Buffer) => {
      cleanup();
      resolve(data.toString("utf8"));
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.once("data", onData);
    socket.once("error", onError);
  });
}

async function sendRedisCommand(
  socket: net.Socket,
  timeoutMs: number,
  command: readonly string[],
): Promise<string> {
  socket.write(encodeRedisCommand(command));
  const response = await readRedisResponse(socket, timeoutMs);
  if (response.startsWith("-")) {
    throw new Error(response.slice(1).trim() || "Redis command failed");
  }
  return response;
}

function connectRedis(config: RedisConfig): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: config.host,
      port: config.port,
    });

    const timer = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error("Redis connection timeout"));
    }, config.connectTimeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("error", onError);
    };

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };

    const onError = (error: Error) => {
      cleanup();
      socket.destroy();
      reject(error);
    };

    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

export async function pingRedis(config: RedisConfig): Promise<RedisPingResult> {
  const startedAt = Date.now();
  let socket: net.Socket | undefined;

  try {
    socket = await connectRedis(config);

    if (config.password) {
      await sendRedisCommand(socket, config.connectTimeoutMs, ["AUTH", config.password]);
    }

    if (config.db > 0) {
      await sendRedisCommand(socket, config.connectTimeoutMs, ["SELECT", String(config.db)]);
    }

    const pong = await sendRedisCommand(socket, config.connectTimeoutMs, ["PING"]);
    if (!pong.includes("PONG")) {
      throw new Error("Redis PING did not return PONG");
    }

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    socket?.end();
    socket?.destroy();
  }
}
