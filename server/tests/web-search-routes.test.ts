import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";

import { createWebSearchRouter } from "../routes/web-search.js";

async function withServer(
  deps: Parameters<typeof createWebSearchRouter>[0] = {},
  handler: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api/web-search", createWebSearchRouter(deps));
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await handler(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

describe("POST /api/web-search/nodes/execute", () => {
  it("rejects unsupported node types", async () => {
    await withServer({}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/web-search/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "dialogue",
          input: {
            query: "cube",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("nodeType must be web_search");
    });
  });

  it("executes web_search with injected executor and returns downstream-ready results", async () => {
    const executeWebSearch = vi.fn(async () => ({
      query: "web qa handoff",
      results: [
        {
          title: "Web QA Handoff",
          url: "https://example.test/web-qa-handoff",
          snippet: "Explains how search results are handed to web QA.",
          source: "mock-web",
        },
      ],
      totalCandidates: 1,
      latencyMs: 15,
      mode: "hybrid" as const,
    }));

    await withServer({ executeWebSearch }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/web-search/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "web_search",
          input: {
            query: "web qa handoff",
            options: {
              topK: 1,
              mode: "hybrid",
            },
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.nodeType).toBe("web_search");
      expect(body.output.results).toEqual([
        {
          title: "Web QA Handoff",
          url: "https://example.test/web-qa-handoff",
          snippet: "Explains how search results are handed to web QA.",
          source: "mock-web",
        },
      ]);
      expect(body.output.citations).toEqual([
        "Web QA Handoff - https://example.test/web-qa-handoff",
      ]);
      expect(body.output.summaries).toEqual([
        "1. Web QA Handoff: Explains how search results are handed to web QA.",
      ]);
      expect(body.output.status).toBe("completed");
      expect(body.output.metadata).toEqual({
        query: "web qa handoff",
        resultCount: 1,
        topK: 1,
        downstreamConsumers: ["web_qa", "static_webpage_read", "end"],
      });
      expect(body.output.handoff).toEqual({
        webQa: {
          question: "web qa handoff",
          citations: ["Web QA Handoff - https://example.test/web-qa-handoff"],
          summaries: [
            "1. Web QA Handoff: Explains how search results are handed to web QA.",
          ],
        },
        staticWebpageRead: {
          urls: ["https://example.test/web-qa-handoff"],
        },
      });
      expect(body.output.observability).toEqual({
        eventKey: "external.web_search",
        nodeType: "web_search",
        query: "web qa handoff",
        mode: "hybrid",
        latencyMs: 15,
        totalCandidates: 1,
      });
    });

    expect(executeWebSearch).toHaveBeenCalledWith({
      query: "web qa handoff",
      options: {
        topK: 1,
        mode: "hybrid",
      },
    });
  });

  it("returns 400 when query is missing", async () => {
    await withServer({}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/web-search/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "web_search",
          input: {},
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("requires query");
    });
  });

  it("returns 500 when the search executor throws", async () => {
    await withServer(
      {
        executeWebSearch: vi.fn(async () => {
          throw new Error("route level search failure");
        }),
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/web-search/nodes/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeType: "web_search",
            input: {
              query: "web qa handoff",
            },
          }),
        });

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toContain("route level search failure");
      },
    );
  });
});
