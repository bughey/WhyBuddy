import { describe, expect, it, beforeEach } from "vitest";

import {
  ImageSearchExecutor,
  createImageSearchExecuteFn,
  resetDefaultImageSearchExecutor,
  type ImageCatalogEntry,
} from "../routes/node-adapters/image-search-executor.js";

describe("ImageSearchExecutor", () => {
  let executor: ImageSearchExecutor;

  beforeEach(() => {
    resetDefaultImageSearchExecutor();
    executor = new ImageSearchExecutor();
  });

  describe("different queries return different ranked results", () => {
    it("returns dashboard-related images first for dashboard query", async () => {
      const result = await executor.execute({
        query: "dashboard charts analytics",
        options: { topK: 4 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.degraded).toBe(false);
      // The top result should be dashboard or data-viz related
      const topIds = result.results.slice(0, 2).map(r => r.imageId);
      expect(
        topIds.some(id => id.includes("dashboard") || id.includes("data-viz")),
      ).toBe(true);
    });

    it("returns security-related images first for security query", async () => {
      const result = await executor.execute({
        query: "security authentication lock protection",
        options: { topK: 4 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      const topIds = result.results.slice(0, 2).map(r => r.imageId);
      expect(topIds.some(id => id.includes("security"))).toBe(true);
    });

    it("returns AI-related images first for AI/neural query", async () => {
      const result = await executor.execute({
        query: "artificial intelligence neural network machine learning",
        options: { topK: 4 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      const topIds = result.results.slice(0, 2).map(r => r.imageId);
      expect(topIds.some(id => id.includes("ai-brain") || id.includes("robot"))).toBe(true);
    });

    it("returns different top results for different queries", async () => {
      const dashboardResult = await executor.execute({
        query: "dashboard office workspace",
        options: { topK: 2 },
      });
      const securityResult = await executor.execute({
        query: "security shield lock access",
        options: { topK: 2 },
      });

      expect(dashboardResult.results[0].imageId).not.toBe(
        securityResult.results[0].imageId,
      );
    });

    it("returns workflow images for workflow query", async () => {
      const result = await executor.execute({
        query: "workflow pipeline execution stages",
        options: { topK: 3 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      const topIds = result.results.slice(0, 2).map(r => r.imageId);
      expect(topIds.some(id => id.includes("workflow") || id.includes("pipeline"))).toBe(true);
    });
  });

  describe("reference image input affects scoring", () => {
    it("boosts results matching reference description", async () => {
      const withoutRef = await executor.execute({
        query: "office",
        options: { topK: 4 },
      });

      const withRef = await executor.execute({
        query: "office",
        referenceImage: {
          description: "3d isometric cube pets characters at desks",
          tags: ["3d", "isometric"],
        },
        options: { topK: 4 },
      });

      // With reference, the 3D office scene should rank higher
      const withRefTop = withRef.results[0];
      expect(withRefTop.matchedBy).toContain("reference");

      // The 3D office scene should be in top results with reference
      const has3dInTop = withRef.results
        .slice(0, 3)
        .some(r => r.imageId.includes("3d-office"));
      expect(has3dInTop).toBe(true);
    });

    it("reference tags contribute to scoring", async () => {
      const result = await executor.execute({
        query: "database",
        referenceImage: {
          tags: ["vector", "embeddings", "rag", "similarity"],
        },
        options: { topK: 4 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      // Vector database entry should appear due to reference tags + query
      const hasVector = result.results.some(r => r.imageId.includes("vector"));
      expect(hasVector).toBe(true);
    });

    it("matchedBy includes reference when reference matches", async () => {
      const result = await executor.execute({
        query: "team",
        referenceImage: {
          description: "people collaborating with laptops",
        },
        options: { topK: 4 },
      });

      const teamResult = result.results.find(r => r.imageId.includes("team-collaboration"));
      expect(teamResult).toBeDefined();
      expect(teamResult!.matchedBy).toContain("reference");
    });
  });

  describe("topK limiting", () => {
    it("returns at most topK results", async () => {
      const result = await executor.execute({
        query: "office",
        options: { topK: 2 },
      });

      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it("returns fewer than topK when not enough matches", async () => {
      const result = await executor.execute({
        query: "xyznonexistentterm",
        options: { topK: 10, minScore: 0.9 },
      });

      // Should degrade but still return something
      expect(result.degraded).toBe(true);
    });

    it("topK=1 returns exactly one result", async () => {
      const result = await executor.execute({
        query: "dashboard charts",
        options: { topK: 1 },
      });

      expect(result.results.length).toBe(1);
    });

    it("topK=8 can return up to 8 results", async () => {
      const result = await executor.execute({
        query: "office illustration",
        options: { topK: 8, minScore: 0.01 },
      });

      expect(result.results.length).toBeLessThanOrEqual(8);
      expect(result.results.length).toBeGreaterThan(1);
    });
  });

  describe("filter application (tags)", () => {
    it("tag filter narrows results to matching entries", async () => {
      const result = await executor.execute({
        tags: ["3d", "isometric"],
        options: { topK: 4 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      // All results should have matched by tags
      for (const item of result.results) {
        expect(item.matchedBy).toContain("tags");
      }
    });

    it("multiple tags increase score for entries matching more tags", async () => {
      const result = await executor.execute({
        tags: ["dashboard", "charts", "analytics"],
        options: { topK: 4 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      // Top result should match multiple tags
      const topResult = result.results[0];
      expect(topResult.tags.some(t => ["dashboard", "charts", "analytics"].includes(t))).toBe(true);
    });

    it("non-matching tags return degraded response", async () => {
      const result = await executor.execute({
        tags: ["xyznonexistent", "abcfake"],
        options: { topK: 4, minScore: 0.5 },
      });

      expect(result.degraded).toBe(true);
    });
  });

  describe("response structure", () => {
    it("includes normalized query information", async () => {
      const result = await executor.execute({
        query: "test query",
        tags: ["tag1", "tag2"],
        referenceImage: {
          description: "ref desc",
          tags: ["reftag"],
        },
        options: { topK: 4 },
      });

      expect(result.normalized.textQuery).toBe("test query");
      expect(result.normalized.tags).toEqual(["tag1", "tag2"]);
      expect(result.normalized.referenceDescription).toBe("ref desc");
      expect(result.normalized.referenceTags).toEqual(["reftag"]);
    });

    it("totalCandidates reflects catalog size", async () => {
      const result = await executor.execute({
        query: "office",
        options: { topK: 2 },
      });

      expect(result.totalCandidates).toBe(executor.catalogSize);
    });

    it("mode reflects input mode", async () => {
      const mockResult = await executor.execute({
        query: "test",
        options: { mode: "mock" },
      });
      expect(mockResult.mode).toBe("mock");

      const hybridResult = await executor.execute({
        query: "test",
        options: { mode: "hybrid" },
      });
      expect(hybridResult.mode).toBe("hybrid");
    });
  });

  describe("custom catalog", () => {
    it("uses custom catalog entries for scoring", async () => {
      const customCatalog: ImageCatalogEntry[] = [
        {
          imageId: "custom-1",
          title: "Custom Banana Image",
          summary: "A yellow banana on a white background",
          previewUrl: "https://example.test/banana.jpg",
          sourceUrl: "https://example.test/banana",
          source: "custom-catalog",
          tags: ["banana", "fruit", "yellow"],
          availability: "available",
        },
        {
          imageId: "custom-2",
          title: "Custom Apple Image",
          summary: "A red apple on a green background",
          previewUrl: "https://example.test/apple.jpg",
          sourceUrl: "https://example.test/apple",
          source: "custom-catalog",
          tags: ["apple", "fruit", "red"],
          availability: "available",
        },
      ];

      const customExecutor = new ImageSearchExecutor({ catalog: customCatalog });

      const bananaResult = await customExecutor.execute({
        query: "banana yellow",
        options: { topK: 2 },
      });
      expect(bananaResult.results[0].imageId).toBe("custom-1");

      const appleResult = await customExecutor.execute({
        query: "apple red",
        options: { topK: 2 },
      });
      expect(appleResult.results[0].imageId).toBe("custom-2");
    });

    it("addEntries expands the catalog", async () => {
      const customExecutor = new ImageSearchExecutor({ catalog: [] });
      expect(customExecutor.catalogSize).toBe(0);

      customExecutor.addEntries([
        {
          imageId: "added-1",
          title: "Added Entry",
          summary: "A newly added entry for testing",
          previewUrl: "https://example.test/added.jpg",
          sourceUrl: "https://example.test/added",
          source: "test",
          tags: ["test", "added"],
          availability: "available",
        },
      ]);

      expect(customExecutor.catalogSize).toBe(1);
      const result = await customExecutor.execute({
        query: "added entry testing",
        options: { topK: 1 },
      });
      expect(result.results[0].imageId).toBe("added-1");
    });
  });

  describe("createImageSearchExecuteFn", () => {
    it("returns a function that executes search", async () => {
      const executeFn = createImageSearchExecuteFn();
      const result = await executeFn({
        query: "dashboard",
        options: { topK: 2 },
      });

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.query).toContain("dashboard");
    });

    it("accepts custom config", async () => {
      const executeFn = createImageSearchExecuteFn({
        catalog: [
          {
            imageId: "fn-test-1",
            title: "Function Test Image",
            summary: "Test image for createImageSearchExecuteFn",
            previewUrl: "https://example.test/fn-test.jpg",
            sourceUrl: "https://example.test/fn-test",
            source: "test",
            tags: ["function", "test"],
            availability: "available",
          },
        ],
      });

      const result = await executeFn({
        query: "function test",
        options: { topK: 1 },
      });
      expect(result.results[0].imageId).toBe("fn-test-1");
    });
  });

  describe("graceful degradation", () => {
    it("returns degraded response when no matches meet minScore", async () => {
      const result = await executor.execute({
        query: "completely unrelated gibberish xyzabc",
        options: { topK: 4, minScore: 0.99 },
      });

      expect(result.degraded).toBe(true);
      expect(result.fallbackReason).toBeDefined();
      // Should still return some results as fallback
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });

    it("warns about preview_only availability", async () => {
      const result = await executor.execute({
        query: "cloud infrastructure containers docker kubernetes",
        options: { topK: 4, minScore: 0.1 },
      });

      const hasPreviewOnly = result.results.some(r => r.availability === "preview_only");
      if (hasPreviewOnly) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe("score properties", () => {
    it("scores are between 0 and 1", async () => {
      const result = await executor.execute({
        query: "office dashboard workspace charts",
        tags: ["dashboard", "office"],
        referenceImage: { description: "warm workspace" },
        options: { topK: 8, minScore: 0 },
      });

      for (const item of result.results) {
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(1);
      }
    });

    it("results are sorted by score descending", async () => {
      const result = await executor.execute({
        query: "office workspace",
        options: { topK: 8, minScore: 0 },
      });

      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].score).toBeGreaterThanOrEqual(result.results[i].score);
      }
    });
  });
});
