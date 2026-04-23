import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import { createStaticWebpageReadRouter } from "../routes/static-webpage-read.js";

async function withServer(
  deps: Parameters<typeof createStaticWebpageReadRouter>[0],
  handler: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api/static-webpage-read", createStaticWebpageReadRouter(deps));

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
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("POST /api/static-webpage-read/nodes/execute", () => {
  it("returns 400 when nodeType is invalid", async () => {
    await withServer({}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/static-webpage-read/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "dialogue",
          input: {
            url: "https://example.test/page",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("nodeType must be static_webpage_read");
    });
  });

  it("returns extracted page payload for inline html requests", async () => {
    await withServer({}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/static-webpage-read/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "static_webpage_read",
          input: {
            url: "https://example.test/guide",
            html: `
              <html>
                <head><title>站内操作指南</title></head>
                <body>
                  <p>打开控制台后，先检查任务状态，再决定是否重试。</p>
                </body>
              </html>
            `,
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.output.status).toBe("completed");
      expect(body.output.page.title).toBe("站内操作指南");
      expect(body.output.handoff.webSearchResult).toEqual({
        title: "站内操作指南",
        url: "https://example.test/guide",
        snippet: expect.stringContaining("打开控制台后"),
        source: "static_webpage_read",
      });
    });
  });

  it("returns fallback payload when fetcher fails and fallback is enabled", async () => {
    await withServer(
      {
        fetchHtml: async () => {
          throw new Error("gateway timeout");
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/static-webpage-read/nodes/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeType: "static_webpage_read",
            input: {
              url: "https://example.test/offline",
              fallback: {
                enabled: true,
                title: "离线网页摘要",
                content: "抓取失败时输出离线摘要。",
              },
            },
          }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.output.status).toBe("fallback");
        expect(body.output.page.contentSource).toBe("fallback");
        expect(body.output.warnings).toContain(
          "网页抓取失败，已回退到静态摘要输出：gateway timeout",
        );
      },
    );
  });
});
