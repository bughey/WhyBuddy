import { describe, expect, it, vi } from "vitest";

import { executeWebSearchNode } from "../routes/node-adapters/web-search-node-adapter.js";

describe("executeWebSearchNode", () => {
  it("normalizes web_search output with citations, summaries, and observability", async () => {
    const executeWebSearch = vi.fn(async () => ({
      query: "cube web qa",
      results: [
        {
          title: "Cube Search Result",
          url: "https://example.test/cube-search",
          snippet: "A result about Cube web QA integration.",
          source: "mock-web",
        },
        {
          title: "Static Read Result",
          url: "https://example.test/static-read",
          snippet: "A result for static webpage reading handoff.",
          source: "mock-web",
        },
      ],
      totalCandidates: 2,
      latencyMs: 12,
      mode: "hybrid" as const,
    }));

    const result = await executeWebSearchNode(
      {
        nodeType: "web_search",
        input: {
          query: "cube web qa",
          options: {
            topK: 2,
            mode: "hybrid",
          },
        },
      },
      {
        executeWebSearch,
      },
    );

    expect(executeWebSearch).toHaveBeenCalledWith({
      query: "cube web qa",
      options: {
        topK: 2,
        mode: "hybrid",
      },
    });
    expect(result).toMatchObject({
      ok: true,
      nodeType: "web_search",
      output: {
        query: "cube web qa",
        totalCandidates: 2,
        latencyMs: 12,
        mode: "hybrid",
        citations: [
          "Cube Search Result - https://example.test/cube-search",
          "Static Read Result - https://example.test/static-read",
        ],
        summaries: [
          "1. Cube Search Result: A result about Cube web QA integration.",
          "2. Static Read Result: A result for static webpage reading handoff.",
        ],
        observability: {
          eventKey: "external.web_search",
          nodeType: "web_search",
          query: "cube web qa",
          mode: "hybrid",
          latencyMs: 12,
          totalCandidates: 2,
        },
      },
    });
    expect(result.output.result.results).toEqual(result.output.results);
  });

  it("falls back to the built-in mock search executor when no external executor is wired", async () => {
    let current = 100;
    const now = () => {
      current += 7;
      return current;
    };

    const result = await executeWebSearchNode(
      {
        nodeType: "web_search",
        input: {
          query: "web qa",
          options: {
            topK: 2,
          },
        },
      },
      {
        now,
      },
    );

    expect(result.output.mode).toBe("mock");
    expect(result.output.results.length).toBeGreaterThan(0);
    expect(result.output.totalCandidates).toBe(result.output.results.length);
    expect(result.output.latencyMs).toBe(7);
    expect(result.output.citations[0]).toContain("https://");
    expect(result.output.summaries[0]).toContain("1.");
  });

  it("rejects web_search without query", async () => {
    await expect(
      executeWebSearchNode({
        nodeType: "web_search",
        input: {},
      }),
    ).rejects.toThrow(/requires query/i);
  });

  it("wraps executor failures with web search node context", async () => {
    await expect(
      executeWebSearchNode(
        {
          nodeType: "web_search",
          input: {
            query: "cube",
          },
        },
        {
          executeWebSearch: vi.fn(async () => {
            throw new Error("search backend unavailable");
          }),
        },
      ),
    ).rejects.toThrow(/Web search node failed: search backend unavailable/);
  });
});
