import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import { createIntentRecognitionRouter } from "../routes/intent-recognition.js";

async function withServer(
  deps: Parameters<typeof createIntentRecognitionRouter>[0] = {},
  handler: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api/intent-recognition", createIntentRecognitionRouter(deps));
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await handler(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

describe("POST /api/intent-recognition/nodes/execute", () => {
  it("rejects unsupported node types", async () => {
    await withServer({}, async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/intent-recognition/nodes/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nodeType: "dialogue",
            input: {
              commandText: "hello",
              userId: "user-1",
            },
          }),
        },
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("nodeType must be intent_recognition");
    });
  });

  it("returns recognition result with command list and recommended command linkage", async () => {
    await withServer(
      {
        analyzer: {
          source: "command_analyzer",
          analyze: async () => ({
            intent: "release_execution",
            entities: [],
            constraints: [],
            objectives: ["完成发布准备"],
            risks: [
              {
                id: "risk-1",
                description: "涉及生产发布窗口",
                level: "high",
                probability: 0.4,
                impact: 0.9,
                mitigation: "先生成计划再执行",
              },
            ],
            assumptions: ["用户需要发布方案"],
            confidence: 0.84,
            needsClarification: false,
          }),
        },
        now: () => 1710000000300,
        idFactory: (() => {
          let counter = 0;
          return () => `route-${++counter}`;
        })(),
      },
      async baseUrl => {
        const response = await fetch(
          `${baseUrl}/api/intent-recognition/nodes/execute`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nodeType: "intent_recognition",
              input: {
                commandText: "整理支付系统发布前检查项",
                userId: "user-1",
                priority: "high",
                locale: "zh-CN",
                planId: "route-plan-1",
              },
            }),
          },
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.output.recognition.intent).toBe("release_execution");
        expect(body.output.routing.mode).toBe("plan_first");
        expect(body.output.commandList.commandList.recommendedCandidateId).toBe(
          "intent-plan",
        );
        expect(body.output.recommendedCommands.suggestions.length).toBeGreaterThanOrEqual(2);
        expect(body.output.events).toHaveLength(2);
      },
    );
  });

  it("returns 400 when commandText is missing", async () => {
    await withServer({}, async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/intent-recognition/nodes/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nodeType: "intent_recognition",
            input: {
              userId: "user-1",
            },
          }),
        },
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("requires commandText");
    });
  });
});
